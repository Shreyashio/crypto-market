// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CryptoMarketEscrow
 * @notice Escrow contract for Crypto-Market P2P token marketplace
 * @dev Holds ERC-20 tokens until INR payment is verified off-chain
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Deploy this contract on Monad Testnet
 * 2. Update ESCROW_CONTRACT_ADDRESS in lib/types.ts with the deployed address
 * 3. Set the ADMIN_PRIVATE_KEY env var for the backend to call releaseToBuyer
 */
contract CryptoMarketEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        address token;
        uint256 amount;
        bool active;
        bool released;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        address token,
        uint256 amount
    );

    event TokensReleased(
        uint256 indexed listingId,
        address indexed buyer
    );

    event ListingCancelled(uint256 indexed listingId);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Seller creates a listing by depositing tokens into escrow
     * @param token The ERC-20 token address
     * @param amount The amount of tokens to escrow
     * @return listingId The ID of the created listing
     */
    function createListing(
        address token,
        uint256 amount
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(token != address(0), "Invalid token address");

        uint256 listingId = nextListingId++;

        // Transfer tokens from seller to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        listings[listingId] = Listing({
            seller: msg.sender,
            token: token,
            amount: amount,
            active: true,
            released: false
        });

        emit ListingCreated(listingId, msg.sender, token, amount);
        return listingId;
    }

    /**
     * @notice Release tokens to buyer after payment verification (admin only)
     * @param listingId The listing ID
     * @param buyer The buyer's wallet address
     */
    function releaseToBuyer(
        uint256 listingId,
        address buyer
    ) external onlyOwner nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(!listing.released, "Already released");
        require(buyer != address(0), "Invalid buyer address");

        listing.active = false;
        listing.released = true;

        // Transfer tokens from escrow to buyer
        IERC20(listing.token).safeTransfer(buyer, listing.amount);

        emit TokensReleased(listingId, buyer);
    }

    /**
     * @notice Cancel listing and return tokens to seller
     * @param listingId The listing ID
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(
            msg.sender == listing.seller || msg.sender == owner(),
            "Not authorized"
        );

        listing.active = false;

        // Return tokens to seller
        IERC20(listing.token).safeTransfer(listing.seller, listing.amount);

        emit ListingCancelled(listingId);
    }

    /**
     * @notice Get listing details
     */
    function getListing(
        uint256 listingId
    )
        external
        view
        returns (
            address seller,
            address token,
            uint256 amount,
            bool active,
            bool released
        )
    {
        Listing storage listing = listings[listingId];
        return (
            listing.seller,
            listing.token,
            listing.amount,
            listing.active,
            listing.released
        );
    }
}
