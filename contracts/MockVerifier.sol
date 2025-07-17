// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockVerifier
 * @dev Mock verifier for testing purposes
 */
contract MockVerifier {
    bool public verificationResult = true;
    
    function setVerificationResult(bool result) external {
        verificationResult = result;
    }
    
    function verifyProof(
        uint[2] calldata,
        uint[2][2] calldata,
        uint[2] calldata,
        uint[1] calldata
    ) external view returns (bool) {
        return verificationResult;
    }
}