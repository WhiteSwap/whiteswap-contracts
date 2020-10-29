pragma solidity ^0.6.12;

interface IWSCallee {
    function wbCall(address sender, uint amount0, uint amount1, bytes calldata data) external;
}
