// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.12;

import '../interfaces/IWSCallee.sol';

contract ExampleFlashSwap is IWSCallee {
    // Any flash swap logic could be implemented in the function
    function wbCall(address sender, uint amount0, uint amount1, bytes calldata data) external override 
        {   
            // Do anything with provided liquidity tokens

        }
}