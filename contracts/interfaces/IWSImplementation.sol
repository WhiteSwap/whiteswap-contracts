pragma solidity ^0.6.12;

interface IWSImplementation {
	function getImplementationType() external pure returns(uint256);
}