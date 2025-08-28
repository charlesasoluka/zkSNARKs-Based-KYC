const { ethers } = require("hardhat");
const axios = require("axios");
const ZKKYCSystem = require("./zkkyc_system.js");
require("dotenv").config();

/**
 * @title Comprehensive Gas Analysis for 100-User ZK KYC System
 * @dev Real gas cost analysis using actual ZK proof generation and verification
 * @dev Integrates with ZKKYCSystem to measure real contract interactions
 */
class GasAnalyzer {
    constructor() {
        this.zkKYCSystem = new ZKKYCSystem();
        this.results = {
            deployment: {},
            operations: {
                perUser: {
                    registration: [],
                    proofGeneration: [],
                    proofVerification: [],
                    nullifierMarking: []
                },
                summary: {}
            },
            pricing: {
                ethPriceGBP: 0,
                currentGasPrice: 0,
                gasPrice: {
                    slow: 0,
                    standard: 0,
                    fast: 0
                }
            },
            statistics: {},
            realProofsGenerated: 0,
            failedProofs: 0
        };
        
        // Statistical calculation helpers
        this.calculateStatistics = this.calculateStatistics.bind(this);
    }

    /**
     * Fetch real-time ETH price in GBP from CoinMarketCap
     */
    async fetchETHPriceGBP() {
        try {
            console.log("💷 Fetching real-time ETH/GBP price from CoinMarketCap...");
            
            const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
                headers: {
                    'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
                    'Accept': 'application/json'
                },
                params: {
                    symbol: 'ETH',
                    convert: 'GBP'
                }
            });
            
            const ethPriceGBP = response.data.data.ETH.quote.GBP.price;
            this.results.pricing.ethPriceGBP = ethPriceGBP;
            
            console.log(`   ✅ Current ETH price: £${ethPriceGBP.toFixed(2)} GBP`);
            return ethPriceGBP;
        } catch (error) {
            console.log(`   ⚠️  Failed to fetch ETH price: ${error.message}`);
            console.log("   📊 Using fallback ETH price: £2,500 GBP");
            this.results.pricing.ethPriceGBP = 2500;
            return 2500;
        }
    }

    /**
     * Fetch current gas prices from Etherscan
     */
    async fetchCurrentGasPrices() {
        try {
            console.log("⛽ Fetching current gas prices from Etherscan...");
            
            const response = await axios.get('https://api.etherscan.io/api', {
                params: {
                    module: 'gastracker',
                    action: 'gasoracle',
                    apikey: process.env.ETHERSCAN_API_KEY
                }
            });
            
            if (response.data.status === '1') {
                const gasData = response.data.result;
                this.results.pricing.gasPrice = {
                    slow: parseInt(gasData.SafeGasPrice),
                    standard: parseInt(gasData.ProposeGasPrice),
                    fast: parseInt(gasData.FastGasPrice)
                };
                
                console.log(`   ✅ Gas Prices: Slow ${gasData.SafeGasPrice} gwei | Standard ${gasData.ProposeGasPrice} gwei | Fast ${gasData.FastGasPrice} gwei`);
                return this.results.pricing.gasPrice;
            }
        } catch (error) {
            console.log(`   ⚠️  Failed to fetch gas prices: ${error.message}`);
        }
        
        // Fallback gas prices
        console.log("   📊 Using fallback gas prices: 10/20/50 gwei");
        this.results.pricing.gasPrice = { slow: 10, standard: 20, fast: 50 };
        return this.results.pricing.gasPrice;
    }

    /**
     * Deploy contracts using ZKKYCSystem and measure real deployment gas costs
     */
    async deployContracts() {
        console.log("📦 Deploying contracts using ZKKYCSystem and measuring real gas costs...");
        
        // Initialize the ZK KYC system first
        await this.zkKYCSystem.initialize();
        
        // Get accounts from zkKYCSystem
        const accounts = this.zkKYCSystem.accounts;
        
        // Deploy contracts manually to capture gas costs
        // (since zkKYCSystem.deployContracts() doesn't return gas measurements)
        
        // Deploy SimpleHasher
        const SimpleHasher = await ethers.getContractFactory("SimpleHasher");
        const hasher = await SimpleHasher.deploy();
        const hasherReceipt = await hasher.deploymentTransaction().wait();
        this.results.deployment.hasher = hasherReceipt.gasUsed;
        
        // Deploy KYCRegistry with all 5 issuers
        const trustedIssuerAddresses = [];
        for (let i = 1; i <= 5; i++) {
            trustedIssuerAddresses.push(accounts.issuers[`issuer${i}`].address);
        }
        
        // Generate public key hashes for secure registry
        const publicKeyHashes = trustedIssuerAddresses.map((addr, i) => 
            ethers.keccak256(ethers.toUtf8Bytes(`issuer_${i}_pubkey`))
        );
        const maxDailyIssuances = [100, 100, 100, 100, 100];
        
        const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
        const kycRegistry = await KYCRegistry.deploy(
            await hasher.getAddress(),
            20, // merkle tree height
            trustedIssuerAddresses,
            publicKeyHashes,
            maxDailyIssuances
        );
        const registryReceipt = await kycRegistry.deploymentTransaction().wait();
        this.results.deployment.kycRegistry = registryReceipt.gasUsed;
        
        // Deploy Verifier
        const Groth16Verifier = await ethers.getContractFactory("contracts/Verifier.sol:Groth16Verifier");
        const verifier = await Groth16Verifier.deploy();
        const verifierReceipt = await verifier.deploymentTransaction().wait();
        this.results.deployment.verifier = verifierReceipt.gasUsed;
        
        // Deploy ZKAccessController
        const ZKAccessController = await ethers.getContractFactory("ZKAccessController");
        const accessController = await ZKAccessController.deploy(
            await kycRegistry.getAddress(),
            await verifier.getAddress(),
            this.zkKYCSystem.deployer.address
        );
        const controllerReceipt = await accessController.deploymentTransaction().wait();
        this.results.deployment.accessController = controllerReceipt.gasUsed;
        
        // Set the contracts in zkKYCSystem for later use
        this.zkKYCSystem.contracts = {
            hasher,
            kycRegistry,
            verifier,
            accessController
        };
        
        console.log(`   ✅ All contracts deployed successfully with real gas measurements`);
        
        return {
            contracts: this.zkKYCSystem.contracts,
            accounts: this.zkKYCSystem.accounts
        };
    }

    /**
     * Run the complete 100-user workflow and measure real gas costs
     */
    async analyze100UserOperations() {
        console.log("⚡ Running complete 100-user ZK KYC workflow to measure REAL gas costs...");
        console.log("⏱️  Expected time: 4-8 minutes for real ZK proof generation");
        
        // Temporarily override zkKYCSystem logging to reduce output during gas analysis
        this.zkKYCSystem.verboseLogging = false;
        
        const startTime = Date.now();
        
        console.log("\n📋 Phase 1: User Registration (measuring real gas costs)...");
        const allUserData = [];
        
        // Register all 100 users and measure real registration gas costs
        for (let i = 1; i <= 100; i++) {
            const issuerIndex = ((i - 1) % 5) + 1;
            const userInIssuerGroup = Math.ceil(i / 5);
            
            const user = this.zkKYCSystem.accounts.users[`user${i}`];
            const issuer = this.zkKYCSystem.accounts.issuers[`issuer${issuerIndex}`];
            const credentialType = this.generateCredentialType(issuerIndex, userInIssuerGroup);
            
            try {
                // Register user and capture gas cost
                const preBalance = await ethers.provider.getBalance(issuer.address);
                const userData = await this.zkKYCSystem.registerUser(user, issuer, i, credentialType);
                const postBalance = await ethers.provider.getBalance(issuer.address);
                
                // Get the last transaction receipt to extract gas used
                const latestBlock = await ethers.provider.getBlock('latest');
                const txHash = latestBlock.transactions[latestBlock.transactions.length - 1];
                const receipt = await ethers.provider.getTransactionReceipt(txHash);
                
                this.results.operations.perUser.registration.push(Number(receipt.gasUsed));
                allUserData.push(userData);
                
                if (i % 10 === 0) {
                    const avgGas = this.results.operations.perUser.registration.reduce((a,b) => a+b, 0) / this.results.operations.perUser.registration.length;
                    console.log(`     ✅ Registered ${i}/100 users (avg: ${Math.round(avgGas).toLocaleString()} gas per registration)`);
                }
            } catch (error) {
                console.log(`     ❌ Registration failed for user ${i}: ${error.message}`);
                this.results.operations.perUser.registration.push(0);
            }
        }
        
        console.log("\n🔍 Phase 2: ZK Proof Generation (real proofs only)...");
        const allProofs = [];
        
        // Generate real ZK proofs for all 100 users
        for (let i = 0; i < 100; i++) {
            if (!allUserData[i]) {
                allProofs.push(null);
                this.results.failedProofs++;
                continue;
            }
            
            const proofStartTime = Date.now();
            const userData = allUserData[i];
            const user = this.zkKYCSystem.accounts.users[`user${i+1}`];
            
            try {
                const proof = await this.zkKYCSystem.generateZKProof(userData, user.address, i+1);
                
                // Only accept real proofs
                if (proof.isReal) {
                    allProofs.push(proof);
                    this.results.realProofsGenerated++;
                    
                    const proofTime = Date.now() - proofStartTime;
                    this.results.operations.perUser.proofGeneration.push(proofTime);
                } else {
                    throw new Error("Mock proof generated - only real proofs allowed");
                }
                
                if ((i + 1) % 5 === 0) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`     🔍 Generated ${i+1}/100 real ZK proofs (${elapsed}s elapsed, ${this.results.realProofsGenerated} successful)`);
                }
            } catch (error) {
                console.log(`     ❌ Real proof generation failed for user ${i+1}: ${error.message}`);
                allProofs.push(null);
                this.results.failedProofs++;
            }
        }
        
        console.log("\n✅ Phase 3: ZK Proof Verification (measuring real gas costs)...");
        
        // Verify proofs and measure real verification gas costs
        for (let i = 0; i < 100; i++) {
            if (!allProofs[i] || !allUserData[i]) {
                continue;
            }
            
            const userData = allUserData[i];
            const user = this.zkKYCSystem.accounts.users[`user${i+1}`];
            
            try {
                // Execute actual verification transaction and measure gas
                const verifyTx = await this.zkKYCSystem.contracts.verifier.verifyProof(
                    allProofs[i].proof.pA,
                    allProofs[i].proof.pB,
                    allProofs[i].proof.pC,
                    allProofs[i].proof.publicSignals
                );
                const verifyReceipt = await verifyTx.wait();
                
                this.results.operations.perUser.proofVerification.push(Number(verifyReceipt.gasUsed));
                
                if ((i + 1) % 10 === 0) {
                    const avgGas = this.results.operations.perUser.proofVerification.reduce((a,b) => a+b, 0) / this.results.operations.perUser.proofVerification.length;
                    console.log(`     ✅ Verified ${this.results.operations.perUser.proofVerification.length} real proofs (avg: ${Math.round(avgGas).toLocaleString()} gas per verification)`);
                }
            } catch (error) {
                console.log(`     ❌ Verification failed for user ${i+1}: ${error.message}`);
            }
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`\n🎉 Complete 100-user workflow analysis finished in ${(totalTime/1000/60).toFixed(1)} minutes`);
        console.log(`   📊 Real proofs generated: ${this.results.realProofsGenerated}/100`);
        console.log(`   📊 Failed proofs: ${this.results.failedProofs}/100`);
        console.log(`   📊 Successful verifications: ${this.results.operations.perUser.proofVerification.length}`);
    }

    /**
     * Calculate comprehensive statistics with advanced analysis
     */
    calculateStatistics(values, name) {
        if (values.length === 0) return null;
        
        const validValues = values.filter(v => v > 0);
        const n = validValues.length;
        const sum = validValues.reduce((a, b) => a + b, 0);
        const mean = sum / n;
        const variance = validValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
        const stdDev = Math.sqrt(variance);
        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        const range = max - min;
        const cv = (stdDev / mean) * 100;
        
        // Calculate confidence interval (95%)
        const tCritical = n >= 30 ? 1.96 : this.getTCritical(n-1);
        const marginError = tCritical * (stdDev / Math.sqrt(n));
        
        // Calculate percentiles
        const sorted = [...validValues].sort((a, b) => a - b);
        const p50 = this.calculatePercentile(sorted, 50);
        const p90 = this.calculatePercentile(sorted, 90);
        const p95 = this.calculatePercentile(sorted, 95);
        const p99 = this.calculatePercentile(sorted, 99);
        
        // Calculate advanced statistics
        const skewness = this.calculateSkewness(validValues, mean, stdDev);
        const kurtosis = this.calculateKurtosis(validValues, mean, stdDev);
        const entropy = this.calculateEntropy(validValues);
        const giniCoefficient = this.calculateGiniCoefficient(validValues);
        
        // Normality tests
        const jarqueBera = this.calculateJarqueBeraTest(validValues, mean, stdDev, skewness, kurtosis);
        const isNormal = jarqueBera.pValue > 0.05;
        
        // Chi-square goodness of fit test
        const chiSquareTest = this.calculateChiSquareGoodnessOfFit(validValues, mean, stdDev);
        
        return {
            name,
            count: n,
            mean: mean,
            median: p50,
            variance: variance,
            stdDev: stdDev,
            min: min,
            max: max,
            range: range,
            coefficientOfVariation: cv,
            confidenceInterval95: [mean - marginError, mean + marginError],
            marginError: marginError,
            percentiles: { p50, p90, p95, p99 },
            // Advanced statistics
            skewness: skewness,
            kurtosis: kurtosis,
            entropy: entropy,
            giniCoefficient: giniCoefficient,
            // Normality tests
            jarqueBera: jarqueBera,
            isNormal: isNormal,
            // Distribution tests
            chiSquareTest: chiSquareTest
        };
    }

    calculatePercentile(sortedArray, percentile) {
        const index = (percentile / 100) * (sortedArray.length - 1);
        if (Number.isInteger(index)) {
            return sortedArray[index];
        } else {
            const lower = sortedArray[Math.floor(index)];
            const upper = sortedArray[Math.ceil(index)];
            return lower + (upper - lower) * (index - Math.floor(index));
        }
    }

    getTCritical(df) {
        // Simplified t-table for 95% confidence
        if (df >= 30) return 1.96;
        const tTable = {1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57, 
                       10: 2.23, 15: 2.13, 20: 2.09, 25: 2.06, 29: 2.05};
        return tTable[Math.min(df, 29)] || 2.05;
    }

    /**
     * Calculate skewness (third moment)
     */
    calculateSkewness(values, mean, stdDev) {
        const n = values.length;
        const skewnessSum = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0);
        return (n / ((n - 1) * (n - 2))) * skewnessSum;
    }

    /**
     * Calculate kurtosis (fourth moment)
     */
    calculateKurtosis(values, mean, stdDev) {
        const n = values.length;
        const kurtosisSum = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0);
        const kurtosis = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * kurtosisSum;
        // Subtract 3 for excess kurtosis
        return kurtosis - 3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3));
    }

    /**
     * Calculate entropy of the distribution
     */
    calculateEntropy(values) {
        // Create bins for entropy calculation
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = Math.min(Math.floor(Math.sqrt(values.length)), 20);
        const binWidth = (max - min) / binCount;
        
        // Count values in each bin
        const bins = new Array(binCount).fill(0);
        values.forEach(val => {
            const binIndex = Math.min(Math.floor((val - min) / binWidth), binCount - 1);
            bins[binIndex]++;
        });
        
        // Calculate entropy: H = -Σ(p * log2(p))
        const n = values.length;
        let entropy = 0;
        bins.forEach(count => {
            if (count > 0) {
                const probability = count / n;
                entropy -= probability * Math.log2(probability);
            }
        });
        
        return entropy;
    }

    /**
     * Calculate Gini coefficient (inequality measure)
     */
    calculateGiniCoefficient(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        const mean = sorted.reduce((a, b) => a + b, 0) / n;
        
        let numerator = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                numerator += Math.abs(sorted[i] - sorted[j]);
            }
        }
        
        return numerator / (2 * n * n * mean);
    }

    /**
     * Jarque-Bera test for normality
     */
    calculateJarqueBeraTest(values, mean, stdDev, skewness, kurtosis) {
        const n = values.length;
        const jb = (n / 6) * (Math.pow(skewness, 2) + Math.pow(kurtosis, 2) / 4);
        
        // Approximate p-value using chi-square distribution with 2 degrees of freedom
        const pValue = this.chiSquarePValue(jb, 2);
        
        return {
            statistic: jb,
            pValue: pValue,
            isSignificant: pValue < 0.05
        };
    }

    /**
     * Chi-square goodness of fit test against normal distribution
     */
    calculateChiSquareGoodnessOfFit(values, mean, stdDev) {
        const n = values.length;
        const binCount = Math.max(5, Math.min(Math.floor(n / 5), 10));
        
        // Create bins
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binWidth = (max - min) / binCount;
        
        // Observed frequencies
        const observed = new Array(binCount).fill(0);
        values.forEach(val => {
            const binIndex = Math.min(Math.floor((val - min) / binWidth), binCount - 1);
            observed[binIndex]++;
        });
        
        // Expected frequencies (assuming normal distribution)
        const expected = new Array(binCount).fill(0);
        for (let i = 0; i < binCount; i++) {
            const binStart = min + i * binWidth;
            const binEnd = min + (i + 1) * binWidth;
            
            // Use normal CDF approximation
            const zStart = (binStart - mean) / stdDev;
            const zEnd = (binEnd - mean) / stdDev;
            
            const probStart = this.normalCDF(zStart);
            const probEnd = this.normalCDF(zEnd);
            
            expected[i] = (probEnd - probStart) * n;
        }
        
        // Calculate chi-square statistic
        let chiSquare = 0;
        for (let i = 0; i < binCount; i++) {
            if (expected[i] > 0) {
                chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
            }
        }
        
        const degreesOfFreedom = binCount - 3; // -3 for estimated parameters (n, mean, stdDev)
        const pValue = this.chiSquarePValue(chiSquare, degreesOfFreedom);
        
        return {
            statistic: chiSquare,
            degreesOfFreedom: degreesOfFreedom,
            pValue: pValue,
            isSignificant: pValue < 0.05,
            observed: observed,
            expected: expected
        };
    }

    /**
     * Approximate normal CDF
     */
    normalCDF(z) {
        // Abramowitz and Stegun approximation
        const sign = z >= 0 ? 1 : -1;
        z = Math.abs(z) / Math.sqrt(2);
        
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        
        const t = 1 / (1 + p * z);
        const erfApprox = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
        
        return 0.5 * (1 + sign * erfApprox);
    }

    /**
     * Approximate chi-square p-value
     */
    chiSquarePValue(chiSquare, df) {
        // Very rough approximation - for more accurate results, use a proper statistical library
        if (df <= 0) return 1;
        
        // Use gamma function approximation for chi-square distribution
        // This is a simplified approximation
        const x = chiSquare;
        const k = df / 2;
        
        if (x <= 0) return 1;
        if (k <= 0) return 0;
        
        // Very rough approximation using normal approximation for large df
        if (df >= 30) {
            const z = Math.sqrt(2 * x) - Math.sqrt(2 * df - 1);
            return 1 - this.normalCDF(z);
        }
        
        // For smaller df, use a lookup table approximation
        const criticalValues = {
            1: [3.84, 6.64, 10.83],  // p = 0.05, 0.01, 0.001
            2: [5.99, 9.21, 13.82],
            3: [7.81, 11.34, 16.27],
            4: [9.49, 13.28, 18.47],
            5: [11.07, 15.09, 20.52],
            10: [18.31, 23.21, 29.59],
            15: [25.00, 30.58, 37.70],
            20: [31.41, 37.57, 45.31]
        };
        
        const closest = Math.min(df, 20);
        const values = criticalValues[closest] || criticalValues[20];
        
        if (x < values[0]) return 0.95;  // p > 0.05
        if (x < values[1]) return 0.02;  // 0.01 < p < 0.05
        if (x < values[2]) return 0.005; // 0.001 < p < 0.01
        return 0.0005; // p < 0.001
    }

    /**
     * Generate comprehensive gas cost report with real pricing
     */
    async generateComprehensiveReport() {
        console.log("\n📊 COMPREHENSIVE 100-USER GAS ANALYSIS REPORT");
        console.log("=" .repeat(80));
        
        // Calculate statistics for each operation type
        const regStats = this.calculateStatistics(this.results.operations.perUser.registration, "User Registration");
        const proofGenStats = this.calculateStatistics(this.results.operations.perUser.proofGeneration, "Proof Generation Time (ms)");
        const proofStats = this.calculateStatistics(this.results.operations.perUser.proofVerification, "Proof Verification");
        const nullifierStats = this.calculateStatistics(this.results.operations.perUser.nullifierMarking, "Nullifier Marking");
        
        this.results.statistics = { regStats, proofGenStats, proofStats, nullifierStats };
        
        // Deployment costs
        console.log("\n🏗️  DEPLOYMENT COSTS:");
        const deploymentCosts = [
            ['SimpleHasher', this.results.deployment.hasher],
            ['KYCRegistry', this.results.deployment.kycRegistry], 
            ['Groth16Verifier', this.results.deployment.verifier],
            ['ZKAccessController', this.results.deployment.accessController]
        ];
        
        let totalDeployment = BigInt(0);
        deploymentCosts.forEach(([name, cost]) => {
            console.log(`   ${name.padEnd(20)} ${this.formatGas(cost)}`);
            totalDeployment += BigInt(cost);
        });
        console.log(`   ${'Total Deployment'.padEnd(20)} ${this.formatGas(totalDeployment)}`);
        
        // Per-user operation statistics
        console.log("\n⚡ PER-USER OPERATION STATISTICS:");
        
        if (regStats) {
            console.log(`\n🔄 USER REGISTRATION (N=${regStats.count}):`);
            console.log(`   Mean: ${Math.round(regStats.mean).toLocaleString()} gas ± ${Math.round(regStats.marginError)}g`);
            console.log(`   95% CI: [${Math.round(regStats.confidenceInterval95[0]).toLocaleString()}, ${Math.round(regStats.confidenceInterval95[1]).toLocaleString()}] gas`);
            console.log(`   Std Dev: ${Math.round(regStats.stdDev).toLocaleString()}g (CV: ${regStats.coefficientOfVariation.toFixed(1)}%)`);
            console.log(`   Range: ${regStats.min.toLocaleString()} - ${regStats.max.toLocaleString()} gas`);
            console.log(`   Percentiles: P50=${Math.round(regStats.percentiles.p50).toLocaleString()}g, P90=${Math.round(regStats.percentiles.p90).toLocaleString()}g, P95=${Math.round(regStats.percentiles.p95).toLocaleString()}g`);
            console.log(`   📋 Advanced Statistics:`);
            console.log(`     Skewness: ${regStats.skewness.toFixed(3)} (${Math.abs(regStats.skewness) < 0.5 ? 'symmetric' : Math.abs(regStats.skewness) < 1 ? 'moderate skew' : 'high skew'})`);
            console.log(`     Kurtosis: ${regStats.kurtosis.toFixed(3)} (${Math.abs(regStats.kurtosis) < 0.5 ? 'normal tail' : regStats.kurtosis > 0 ? 'heavy tail' : 'light tail'})`);
            console.log(`     Entropy: ${regStats.entropy.toFixed(3)} bits`);
            console.log(`     Gini Coefficient: ${regStats.giniCoefficient.toFixed(3)} (inequality measure)`);
            console.log(`     Normality: ${regStats.isNormal ? 'Normal' : 'Non-normal'} (Jarque-Bera p=${regStats.jarqueBera.pValue.toFixed(4)})`);
            console.log(`     Chi-square test: ${regStats.chiSquareTest.isSignificant ? 'Rejects normality' : 'Consistent with normality'} (p=${regStats.chiSquareTest.pValue.toFixed(4)})`);
        }
        
        if (proofStats) {
            console.log(`\n🔍 PROOF VERIFICATION (N=${proofStats.count}):`);
            console.log(`   Mean: ${Math.round(proofStats.mean).toLocaleString()} gas ± ${Math.round(proofStats.marginError)}g`);
            console.log(`   95% CI: [${Math.round(proofStats.confidenceInterval95[0]).toLocaleString()}, ${Math.round(proofStats.confidenceInterval95[1]).toLocaleString()}] gas`);
            console.log(`   Std Dev: ${Math.round(proofStats.stdDev).toLocaleString()}g (CV: ${proofStats.coefficientOfVariation.toFixed(1)}%)`);
            console.log(`   Range: ${proofStats.min.toLocaleString()} - ${proofStats.max.toLocaleString()} gas`);
            console.log(`   Percentiles: P50=${Math.round(proofStats.percentiles.p50).toLocaleString()}g, P90=${Math.round(proofStats.percentiles.p90).toLocaleString()}g, P99=${Math.round(proofStats.percentiles.p99).toLocaleString()}g`);
            console.log(`   📋 Advanced Statistics:`);
            console.log(`     Skewness: ${proofStats.skewness.toFixed(3)}`);
            console.log(`     Kurtosis: ${proofStats.kurtosis.toFixed(3)}`);
            console.log(`     Entropy: ${proofStats.entropy.toFixed(3)} bits`);
            console.log(`     Normality: ${proofStats.isNormal ? 'Normal' : 'Non-normal'} distribution`);
        }
        
        // Add proof generation statistics if available
        if (proofGenStats) {
            console.log(`\n⏱️  ZK PROOF GENERATION TIME (N=${proofGenStats.count}):`);
            console.log(`   Mean: ${(proofGenStats.mean/1000).toFixed(2)}s ± ${(proofGenStats.marginError/1000).toFixed(2)}s`);
            console.log(`   95% CI: [${(proofGenStats.confidenceInterval95[0]/1000).toFixed(2)}, ${(proofGenStats.confidenceInterval95[1]/1000).toFixed(2)}]s`);
            console.log(`   Std Dev: ${(proofGenStats.stdDev/1000).toFixed(2)}s (CV: ${proofGenStats.coefficientOfVariation.toFixed(1)}%)`);
            console.log(`   Range: ${(proofGenStats.min/1000).toFixed(2)}s - ${(proofGenStats.max/1000).toFixed(2)}s`);
            console.log(`   Percentiles: P50=${(proofGenStats.percentiles.p50/1000).toFixed(2)}s, P90=${(proofGenStats.percentiles.p90/1000).toFixed(2)}s, P99=${(proofGenStats.percentiles.p99/1000).toFixed(2)}s`);
            console.log(`   📋 Proof Generation Analysis:`);
            console.log(`     Distribution: ${proofGenStats.isNormal ? 'Normal' : 'Non-normal'}`);
            console.log(`     Consistency: CV ${proofGenStats.coefficientOfVariation < 10 ? 'Low' : proofGenStats.coefficientOfVariation < 25 ? 'Moderate' : 'High'} (${proofGenStats.coefficientOfVariation.toFixed(1)}%)`);
            console.log(`     Performance: ${proofGenStats.mean < 5000 ? 'Excellent' : proofGenStats.mean < 10000 ? 'Good' : proofGenStats.mean < 30000 ? 'Acceptable' : 'Needs optimization'} (${(proofGenStats.mean/1000).toFixed(1)}s avg)`);
        }
        
        if (nullifierStats) {
            console.log(`\n✅ NULLIFIER MARKING (N=${nullifierStats.count}):`);
            console.log(`   Mean: ${Math.round(nullifierStats.mean).toLocaleString()} gas ± ${Math.round(nullifierStats.marginError)}g`);
            console.log(`   95% CI: [${Math.round(nullifierStats.confidenceInterval95[0]).toLocaleString()}, ${Math.round(nullifierStats.confidenceInterval95[1]).toLocaleString()}] gas`);
        }
        
        // Real-time cost analysis
        console.log(`\n💷 REAL-TIME COST ANALYSIS (ETH = £${this.results.pricing.ethPriceGBP.toFixed(2)} GBP):`);
        this.analyzeRealTimeCosts();
        
        // Enhanced system performance analysis
        console.log(`\n🎯 ENHANCED SYSTEM PERFORMANCE ANALYSIS:`);
        this.analyzeEnhancedSystemPerformance();
        
        // 100-user system totals
        console.log(`\n📊 100-USER SYSTEM TOTALS:`);
        this.analyze100UserSystemCosts();
        
        // Optimization recommendations
        console.log(`\n🔧 OPTIMIZATION RECOMMENDATIONS:`);
        this.generateOptimizationRecommendations();
        
        console.log("\n" + "=" .repeat(80));
    }

    analyzeRealTimeCosts() {
        const gasPrices = ['slow', 'standard', 'fast'];
        const ethPrice = this.results.pricing.ethPriceGBP;
        
        console.log(`   Operation                     Slow (${this.results.pricing.gasPrice.slow}g)    Standard (${this.results.pricing.gasPrice.standard}g)    Fast (${this.results.pricing.gasPrice.fast}g)`);
        console.log(`   ${"-".repeat(78)}`);
        
        const operations = [
            ['User Registration', this.results.statistics.regStats?.mean || 0],
            ['Proof Verification', this.results.statistics.proofStats?.mean || 0],
            ['Nullifier Marking', this.results.statistics.nullifierStats?.mean || 0]
        ];
        
        operations.forEach(([name, gas]) => {
            if (gas > 0) {
                const costs = Object.values(this.results.pricing.gasPrice).map(gwei => {
                    const ethCost = gas * gwei * 1e-9; // Convert to ETH
                    const gbpCost = ethCost * ethPrice;
                    return `£${gbpCost.toFixed(4)}`;
                });
                
                console.log(`   ${name.padEnd(25)} ${costs.map(c => c.padStart(12)).join('')}`);
            }
        });
    }

    /**
     * Enhanced system performance analysis with real metrics
     */
    analyzeEnhancedSystemPerformance() {
        const regStats = this.results.statistics.regStats;
        const proofGenStats = this.results.statistics.proofGenStats;
        const proofStats = this.results.statistics.proofStats;
        
        console.log(`   📊 REAL PROOF GENERATION SUCCESS RATE:`);
        console.log(`     Successful: ${this.results.realProofsGenerated}/100 (${(this.results.realProofsGenerated/100*100).toFixed(1)}%)`);
        console.log(`     Failed: ${this.results.failedProofs}/100 (${(this.results.failedProofs/100*100).toFixed(1)}%)`);
        
        if (proofGenStats && this.results.realProofsGenerated > 0) {
            const totalProofTime = proofGenStats.count * proofGenStats.mean;
            console.log(`     Total Proof Generation Time: ${(totalProofTime/1000/60).toFixed(1)} minutes`);
            console.log(`     Theoretical Throughput: ${(3600000/proofGenStats.mean).toFixed(1)} proofs/hour`);
            
            // System scalability analysis
            console.log(`   \n🚀 SYSTEM SCALABILITY ANALYSIS:`);
            const timeFor1000Users = (1000 * proofGenStats.mean / 1000 / 60).toFixed(0);
            const timeFor10000Users = (10000 * proofGenStats.mean / 1000 / 60 / 60).toFixed(1);
            console.log(`     Time for 1,000 users: ~${timeFor1000Users} minutes`);
            console.log(`     Time for 10,000 users: ~${timeFor10000Users} hours`);
            
            // Performance classification
            const avgProofTimeMs = proofGenStats.mean;
            let performanceClass;
            if (avgProofTimeMs < 1000) performanceClass = "Excellent (<1s)";
            else if (avgProofTimeMs < 5000) performanceClass = "Good (1-5s)";
            else if (avgProofTimeMs < 15000) performanceClass = "Acceptable (5-15s)";
            else if (avgProofTimeMs < 60000) performanceClass = "Slow (15-60s)";
            else performanceClass = "Very Slow (>1m)";
            
            console.log(`     Performance Class: ${performanceClass}`);
        }
        
        if (regStats && proofStats) {
            console.log(`   \n📋 STATISTICAL RELIABILITY:`);
            console.log(`     Registration Consistency: CV ${regStats.coefficientOfVariation.toFixed(1)}% (${regStats.coefficientOfVariation < 5 ? 'Excellent' : regStats.coefficientOfVariation < 15 ? 'Good' : 'Needs improvement'})`);
            console.log(`     Verification Consistency: CV ${proofStats.coefficientOfVariation.toFixed(1)}% (${proofStats.coefficientOfVariation < 5 ? 'Excellent' : proofStats.coefficientOfVariation < 15 ? 'Good' : 'Needs improvement'})`);
            
            // Entropy analysis for privacy
            if (regStats.entropy && proofStats.entropy) {
                console.log(`   \n🔒 PRIVACY & ENTROPY ANALYSIS:`);
                console.log(`     Registration Entropy: ${regStats.entropy.toFixed(2)} bits (diversity: ${regStats.entropy > 3 ? 'High' : regStats.entropy > 2 ? 'Medium' : 'Low'})`);
                console.log(`     Verification Entropy: ${proofStats.entropy.toFixed(2)} bits`);
                console.log(`     Anonymity Set Size: 100 users (${Math.log2(100).toFixed(2)} bits max entropy)`);
                console.log(`     Privacy Level: ${regStats.entropy > 4 ? 'Excellent' : regStats.entropy > 3 ? 'Good' : 'Moderate'}`);
            }
        }
    }

    analyze100UserSystemCosts() {
        const regStats = this.results.statistics.regStats;
        const proofStats = this.results.statistics.proofStats;
        const nullifierStats = this.results.statistics.nullifierStats;
        
        if (regStats && proofStats) {
            // Only include operations that actually occurred
            let totalGasPerUser = regStats.mean + (proofStats.mean || 0);
            if (nullifierStats) totalGasPerUser += nullifierStats.mean;
            
            const total100Users = totalGasPerUser * 100;
            const totalWithDeployment = total100Users + Number(Object.values(this.results.deployment).reduce((a, b) => a + b, BigInt(0)));
            
            console.log(`   Per User (Registration + Verification${nullifierStats ? ' + Nullifier' : ''}):`);
            console.log(`     Average: ${Math.round(totalGasPerUser).toLocaleString()} gas`);
            console.log(`   100 Users Total: ${Math.round(total100Users).toLocaleString()} gas`);
            console.log(`   Including Deployment: ${Math.round(totalWithDeployment).toLocaleString()} gas`);
            
            // Cost breakdown at standard gas price
            const standardGasPrice = this.results.pricing.gasPrice.standard;
            const ethPrice = this.results.pricing.ethPriceGBP;
            
            const perUserCostGBP = (totalGasPerUser * standardGasPrice * 1e-9) * ethPrice;
            const total100UsersCostGBP = perUserCostGBP * 100;
            
            console.log(`\n   💷 Cost at Standard Gas Price (${standardGasPrice} gwei):`);
            console.log(`     Per User: £${perUserCostGBP.toFixed(4)}`);
            console.log(`     100 Users: £${total100UsersCostGBP.toFixed(2)}`);
            
            // Add cost efficiency analysis
            console.log(`   \n💰 COST EFFICIENCY ANALYSIS:`);
            if (perUserCostGBP < 0.01) console.log(`     Cost Level: Excellent (<£1p per user)`);
            else if (perUserCostGBP < 0.05) console.log(`     Cost Level: Good (<5p per user)`);
            else if (perUserCostGBP < 0.20) console.log(`     Cost Level: Acceptable (<20p per user)`);
            else console.log(`     Cost Level: High (>${perUserCostGBP.toFixed(2)}p per user)`);
        }
    }

    generateOptimizationRecommendations() {
        const proofStats = this.results.statistics.proofStats;
        const regStats = this.results.statistics.regStats;
        const proofGenStats = this.results.statistics.proofGenStats;
        
        console.log(`   📋 PERFORMANCE-BASED RECOMMENDATIONS:`);
        
        // Gas cost optimizations based on real measurements
        if (proofStats && proofStats.mean > 250000) {
            console.log(`   🔹 ZK Proof verification (${Math.round(proofStats.mean).toLocaleString()}g avg) is the highest cost operation`);
            console.log(`   🔹 Consider batch verification to amortize costs across multiple proofs`);
        }
        
        if (regStats && regStats.coefficientOfVariation > 20) {
            console.log(`   🔹 Registration costs show high variance (CV: ${regStats.coefficientOfVariation.toFixed(1)}%)`);
            console.log(`   🔹 Consider optimizing Merkle tree operations for consistency`);
        }
        
        // Proof generation time optimizations
        if (proofGenStats) {
            if (proofGenStats.mean > 30000) {
                console.log(`   🔹 Proof generation is slow (${(proofGenStats.mean/1000).toFixed(1)}s avg) - consider:`);
                console.log(`      • Optimizing circuit constraints`);
                console.log(`      • Using trusted setup with better parameters`);
                console.log(`      • Parallel proof generation`);
            }
            
            if (proofGenStats.coefficientOfVariation > 30) {
                console.log(`   🔹 High proof generation variance (CV: ${proofGenStats.coefficientOfVariation.toFixed(1)}%) - investigate:`);
                console.log(`      • System resource contention`);
                console.log(`      • Circuit input complexity variations`);
            }
        }
        
        // Success rate optimizations
        if (this.results.realProofsGenerated < 95) {
            console.log(`   🔹 Low proof success rate (${(this.results.realProofsGenerated/100*100).toFixed(1)}%) - check:`);
            console.log(`      • Circuit compilation issues`);
            console.log(`      • Witness generation errors`);
            console.log(`      • Memory/resource constraints`);
        }
        
        // Statistical distribution recommendations
        if (regStats && !regStats.isNormal) {
            console.log(`   🔹 Non-normal gas cost distribution detected - may indicate:`);
            console.log(`      • Edge cases in contract logic`);
            console.log(`      • Different execution paths`);
        }
        
        // General scalability recommendations
        console.log(`   \n📋 SCALABILITY RECOMMENDATIONS:`);
        console.log(`   🔹 Deploy on L2 networks (Polygon, Arbitrum) for 10-100x cost reduction`);
        console.log(`   🔹 Implement proof caching to avoid repeated verifications`);
        console.log(`   🔹 Use meta-transactions to subsidize user costs`);
        console.log(`   🔹 Consider upgrading to more efficient proof systems (PLONK, FRI-based STARKs)`);
        console.log(`   🔹 Implement circuit optimization techniques (constraint reduction)`);
        console.log(`   🔹 Consider proof aggregation for batch operations`);
    }

    formatGas(gasAmount) {
        const gas = Number(gasAmount);
        return `${gas.toLocaleString()} gas`;
    }

    /**
     * Generate credential type based on issuer and user index
     */
    generateCredentialType(issuerIndex, userIndex) {
        const credentialTypes = {
            1: "Corporate Employee",
            2: "University Graduate", 
            3: "Government Citizen",
            4: "Healthcare Professional",
            5: "Financial Institution Member"
        };
        return `${credentialTypes[issuerIndex]} #${userIndex}`;
    }

    /**
     * Main analysis function - runs complete real ZK KYC workflow and measures gas costs
     */
    async analyzeAll() {
        console.log("🔍 Starting comprehensive 100-user gas analysis with REAL ZK proofs...\n");
        
        // Fetch real-time pricing data
        await this.fetchETHPriceGBP();
        await this.fetchCurrentGasPrices();
        
        // Deploy contracts using ZKKYCSystem
        await this.deployContracts();
        
        // Run complete 100-user workflow with real ZK proofs
        await this.analyze100UserOperations();
        
        // Generate comprehensive report with enhanced statistics
        await this.generateComprehensiveReport();
        
        return this.results;
    }
}

// Main execution
async function main() {
    const analyzer = new GasAnalyzer();
    await analyzer.analyzeAll();
}

// Export for use in other modules
module.exports = { GasAnalyzer };

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error("❌ Gas analysis failed:", error);
        process.exitCode = 1;
    });
}