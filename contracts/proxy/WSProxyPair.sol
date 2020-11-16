pragma solidity ^0.6.12;

import './WSProxy.sol';

contract WSProxyPair is TransparentUpgradeableProxy {
    constructor() public payable TransparentUpgradeableProxy() {
    }
}