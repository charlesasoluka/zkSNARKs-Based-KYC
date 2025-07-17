const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

class CircuitCompiler {
  constructor() {
    this.circuitsDir = path.join(__dirname, "../circuits");
    this.buildDir = path.join(__dirname, "../build");
    this.ptauFile = path.join(this.circuitsDir, "pot15_final.ptau");
  }

  async ensureDirectories() {
    if (!fs.existsSync(this.buildDir)) {
      fs.mkdirSync(this.buildDir, { recursive: true });
    }
  }

  async compileCircuit(circuitName = "zkkyc") {
    console.log(`\n🔧 Compiling circuit: ${circuitName}`);
    
    try {
      await this.ensureDirectories();
      
      const circuitPath = path.join(this.circuitsDir, `${circuitName}.circom`);
      const outputDir = path.join(this.buildDir, circuitName);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Step 1: Compile circuit
      console.log("📦 Compiling circuit with circom...");
      await execAsync(`circom ${circuitPath} --r1cs --wasm --sym --c -o ${outputDir}`);
      
      // Step 2: Witness calculator is ready (skip witness generation for now)
      console.log("⚡ Witness calculator generated successfully...");
      
      console.log(`✅ Circuit ${circuitName} compiled successfully!`);
      return {
        r1csPath: path.join(outputDir, `${circuitName}.r1cs`),
        wasmPath: path.join(outputDir, `${circuitName}_js`, `${circuitName}.wasm`),
        symPath: path.join(outputDir, `${circuitName}.sym`)
      };
      
    } catch (error) {
      console.error(`❌ Error compiling circuit ${circuitName}:`, error.message);
      throw error;
    }
  }

  async setupTrustedSetup(circuitName = "zkkyc") {
    console.log(`\n🔐 Setting up trusted setup for ${circuitName}`);
    
    try {
      const outputDir = path.join(this.buildDir, circuitName);
      const r1csPath = path.join(outputDir, `${circuitName}.r1cs`);
      
      if (!fs.existsSync(r1csPath)) {
        throw new Error(`R1CS file not found. Please compile the circuit first.`);
      }

      // Step 1: Start powers of tau ceremony
      console.log("🌟 Starting powers of tau ceremony...");
      const ptauPath = path.join(outputDir, `${circuitName}.ptau`);
      
      if (!fs.existsSync(this.ptauFile)) {
        console.log("📥 Downloading powers of tau file...");
        await execAsync(`cd ${this.circuitsDir} && wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau -O pot15_final.ptau`);
      }
      
      // Step 2: Generate zkey phase 1
      console.log("🔑 Generating zkey phase 1...");
      const zkeyPath = path.join(outputDir, `${circuitName}_0000.zkey`);
      await execAsync(`snarkjs groth16 setup ${r1csPath} ${this.ptauFile} ${zkeyPath}`);
      
      // Step 3: Contribute to ceremony (phase 2)
      console.log("🤝 Contributing to ceremony...");
      const finalZkeyPath = path.join(outputDir, `${circuitName}_0001.zkey`);
      await execAsync(`snarkjs zkey contribute ${zkeyPath} ${finalZkeyPath} --name="First contribution" -v`);
      
      // Step 4: Generate verification key
      console.log("✨ Generating verification key...");
      const vkeyPath = path.join(outputDir, `verification_key.json`);
      await execAsync(`snarkjs zkey export verificationkey ${finalZkeyPath} ${vkeyPath}`);
      
      // Step 5: Generate Solidity verifier
      console.log("📝 Generating Solidity verifier...");
      const verifierPath = path.join(__dirname, "../contracts/Verifier.sol");
      await execAsync(`snarkjs zkey export solidityverifier ${finalZkeyPath} ${verifierPath}`);
      
      console.log(`✅ Trusted setup completed for ${circuitName}!`);
      return {
        zkeyPath: finalZkeyPath,
        vkeyPath,
        verifierPath
      };
      
    } catch (error) {
      console.error(`❌ Error in trusted setup for ${circuitName}:`, error.message);
      throw error;
    }
  }

  async generateTestInput(circuitName = "zkkyc") {
    console.log(`\n🧪 Generating test input for ${circuitName}`);
    
    const { MerkleTree, IdentityManager } = require("./merkle-utils");
    
    try {
      const tree = new MerkleTree(20);
      const identityManager = new IdentityManager();
      
      // Create test identity
      const testDid = "did:example:123456789";
      const identity = identityManager.createIdentity(testDid);
      
      // Insert commitment into tree
      tree.insert(identity.commitment);
      
      // Generate test inputs
      const currentTime = Math.floor(Date.now() / 1000);
      const birthDate = currentTime - (25 * 365 * 24 * 60 * 60); // 25 years old
      const minimumAge = 18;
      
      const input = identityManager.generateProofInputs(
        testDid,
        tree,
        currentTime,
        birthDate,
        minimumAge
      );
      
      const inputPath = path.join(this.buildDir, circuitName, "input.json");
      fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
      
      console.log(`✅ Test input generated at ${inputPath}`);
      return input;
      
    } catch (error) {
      console.error(`❌ Error generating test input:`, error.message);
      throw error;
    }
  }

  async fullSetup(circuitName = "zkkyc") {
    console.log(`\n🚀 Starting full setup for ${circuitName}\n`);
    
    try {
      // Step 1: Compile circuit
      const compileResult = await this.compileCircuit(circuitName);
      
      // Step 2: Generate test input
      await this.generateTestInput(circuitName);
      
      // Step 3: Setup trusted setup
      const setupResult = await this.setupTrustedSetup(circuitName);
      
      console.log(`\n🎉 Full setup completed for ${circuitName}!`);
      console.log(`📍 Build directory: ${this.buildDir}/${circuitName}`);
      
      return {
        ...compileResult,
        ...setupResult
      };
      
    } catch (error) {
      console.error(`❌ Full setup failed:`, error.message);
      throw error;
    }
  }
}

async function main() {
  const compiler = new CircuitCompiler();
  
  try {
    await compiler.fullSetup("zkkyc");
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  }
}

module.exports = { CircuitCompiler };

if (require.main === module) {
  main();
}