// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract MythoForge is ERC721, ERC721URIStorage {
    uint256 private _nextTokenId = 1;

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    mapping(uint256 => Listing) public listings;

    event CardMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string tokenURI
    );

    event CardListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    event CardSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );

    event CardDelisted(
        uint256 indexed tokenId,
        address indexed seller
    );

    constructor() ERC721("MythoForge", "MYTH") {}

    function mintCard(string memory uri) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        emit CardMinted(tokenId, msg.sender, uri);

        return tokenId;
    }

    function listCard(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than zero");
        require(
            isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit CardListed(tokenId, msg.sender, price);
    }

    function cancelListing(uint256 tokenId) external {
        Listing memory listing = listings[tokenId];

        require(listing.active, "Card is not listed");
        require(listing.seller == msg.sender, "Not the seller");

        delete listings[tokenId];

        emit CardDelisted(tokenId, msg.sender);
    }

    function buyCard(uint256 tokenId) external payable {
        Listing memory listing = listings[tokenId];

        require(listing.active, "Card is not listed");
        require(ownerOf(tokenId) == listing.seller, "Seller no longer owns card");
        require(
            msg.value == listing.price,
            "Incorrect payment"
        );
        require(
            msg.sender != listing.seller,
            "Seller cannot buy own card"
        );
        require(
            isApprovedForAll(listing.seller, address(this)),
            "Marketplace approval revoked"
        );

        delete listings[tokenId];

        _transfer(listing.seller, msg.sender, tokenId);

        (bool success, ) = payable(listing.seller).call{
            value: msg.value
        }("");

        require(success, "Payment failed");

        emit CardSold(
            tokenId,
            listing.seller,
            msg.sender,
            msg.value
        );
    }

    function getListing(uint256 tokenId)
        external
        view
        returns (
            address seller,
            uint256 price,
            bool active
        )
    {
        Listing memory listing = listings[tokenId];

        return (
            listing.seller,
            listing.price,
            listing.active
        );
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}