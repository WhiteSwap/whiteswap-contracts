pragma solidity ^0.6.12;

interface IWSUpdate {
    function isUpdated() external returns(uint256);
    function initialize(uint256 _value) external;
    function getUpdateValue() external view returns(uint256);
}
