// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.12;

import './WSUpdate.sol';

contract WSPairUpdate is WSUpdate {
    function getImplementationType() external pure override returns(uint256) {
        return 2;
    }
}