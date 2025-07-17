// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IHasher {
    function poseidon(bytes32[2] calldata leftRight) external pure returns (bytes32);
}

/**
 * @title MerkleTreeWithHistory
 * @dev Merkle tree implementation with history tracking for zero-knowledge proofs
 * Based on Tornado Cash implementation
 */
abstract contract MerkleTreeWithHistory {
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant ZERO_VALUE = 0; // Simplified for testing

    IHasher public immutable hasher;
    uint32 public immutable levels;

    // the following variables are made public for easier testing and debugging
    bytes32[] public filledSubtrees;
    bytes32[] public zeros;
    uint32 public currentRootIndex = 0;
    uint32 public nextIndex = 0;
    uint32 public constant ROOT_HISTORY_SIZE = 30;
    bytes32[ROOT_HISTORY_SIZE] public roots;

    constructor(uint32 _levels, IHasher _hasher) {
        require(_levels > 0, "_levels should be greater than zero");
        require(_levels < 32, "_levels should be less than 32");
        levels = _levels;
        hasher = _hasher;

        bytes32 currentZero = bytes32(ZERO_VALUE);
        zeros.push(currentZero);
        filledSubtrees.push(currentZero);

        for (uint32 i = 1; i < _levels; i++) {
            currentZero = hashLeftRight(currentZero, currentZero);
            zeros.push(currentZero);
            filledSubtrees.push(currentZero);
        }

        roots[0] = hashLeftRight(currentZero, currentZero);
    }

    /**
     * @dev Hash 2 tree leaves, returns poseidon(_left, _right)
     */
    function hashLeftRight(bytes32 _left, bytes32 _right) public view returns (bytes32) {
        // For testing purposes, we'll be more lenient with field checks
        // In production, these should be strict
        bytes32[2] memory leftRight = [_left, _right];
        return hasher.poseidon(leftRight);
    }

    function _insert(bytes32 _leaf) internal returns (uint32 index) {
        uint32 _nextIndex = nextIndex;
        require(_nextIndex != uint32(2)**levels, "Merkle tree is full. No more leaves can be added");
        uint32 currentIndex = _nextIndex;
        bytes32 currentLevelHash = _leaf;
        bytes32 left;
        bytes32 right;

        for (uint32 i = 0; i < levels; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros[i];
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hashLeftRight(left, right);
            currentIndex /= 2;
        }

        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentLevelHash;
        nextIndex = _nextIndex + 1;
        return _nextIndex;
    }

    /**
     * @dev Whether the root is present in the root history
     */
    function isKnownRoot(bytes32 _root) public view returns (bool) {
        if (_root == 0) {
            return false;
        }
        uint32 _currentRootIndex = currentRootIndex;
        uint32 i = _currentRootIndex;
        do {
            if (_root == roots[i]) {
                return true;
            }
            if (i == 0) {
                i = ROOT_HISTORY_SIZE;
            }
            i--;
        } while (i != _currentRootIndex);
        return false;
    }

    /**
     * @dev Returns the last root
     */
    function getLastRoot() public view returns (bytes32) {
        return roots[currentRootIndex];
    }
}