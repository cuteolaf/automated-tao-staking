// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract WstTAO is Ownable, ERC20, ERC20Burnable, ReentrancyGuard {
    address public bridge;

    constructor() ERC20("Wrapped stTAO token", "WstTAO") {
        _mint(msg.sender, 21_000_000 * 10 ** decimals());
    }

    modifier onlyBridge() {
        require(
            msg.sender == bridge,
            "Only the bridge owner is available to access"
        );
        _;
    }

    function getBridge() public view returns (address bridge_) {
        bridge_ = bridge;
    }

    function setBridge(address _bridge) external onlyOwner {
        address caller = msg.sender;
        if (bridge != address(0)) {
            uint256 currentAllowance = allowance(caller, bridge);
            decreaseAllowance(bridge, currentAllowance);
        }
        bridge = _bridge;
        approve(bridge, balanceOf(caller));
    }

    function mint(address recipient, uint256 amount) external onlyBridge {
        uint256 remaining = balanceOf(owner());
        require(
            amount < remaining,
            "Requested amount exceeds the remaining balance"
        );
        transferFrom(owner(), recipient, amount);
    }

    function burn(address from, uint256 amount) external onlyBridge {
        // TODO:
    }
}
