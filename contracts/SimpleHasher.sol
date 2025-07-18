// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MerkleTreeWithHistory.sol";

/**
 * @title SimpleHasher
 * @dev Simple hasher implementation for testing
 * Uses Keccak256 instead of Poseidon for simplicity
 */
contract SimpleHasher is IHasher {
    function poseidon(bytes32[2] calldata leftRight) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(leftRight[0], leftRight[1]));
    }
}