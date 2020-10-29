// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.12;

contract WSUpdate {
    // some values to do not disturbe other
    uint256 public updateValue2;
    uint256 public updateValue25;
    uint256 public updateValue24;
    uint256 public updateValue222;
    uint256 public updateValue22;

    uint256 public updateValue;

    function initialize(uint256 _value) external {
        updateValue =_value;
    }

    function isUpdated() external pure returns(uint256) {
        return 360894;
    }

    function getUpdateValue() external view returns(uint256) {
        return updateValue;
    }

    function getImplementationType() external virtual pure returns(uint256) {
        return 3;
    }
}