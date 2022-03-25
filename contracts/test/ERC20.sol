pragma solidity >=0.5.16;

import '../JioswapERC20.sol';

contract ERC20 is JioswapERC20 {
    constructor(uint _totalSupply) public {
        _mint(msg.sender, _totalSupply);
    }
}
