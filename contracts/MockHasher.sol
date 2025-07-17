// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MerkleTreeWithHistory.sol";

/**
 * @title MockHasher
 * @dev Mock hasher for testing purposes
 */
contract MockHasher is IHasher {
    function poseidon(bytes32[2] calldata leftRight) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(leftRight[0], leftRight[1]));
    }
}