import { Fn } from "cdktf";

/**
 * @dev Get public subnet cidr blocks for the cidr prefix provided
 *
 * @param {string} cidrPrefix
 */
export function getPublicSubnetCidrBlocks(cidrPrefix: string) {
    return [
        Fn.cidrsubnet(cidrPrefix, 8, 0),
        Fn.cidrsubnet(cidrPrefix, 8, 1)
    ]
}

/**
 * @dev Get public subnet cidr blocks for the cidr prefix provided
 *
 * @param {string} cidrPrefix
 * @param {number} privateSubnetCount
 * @param {number} netNumStart
 */
export function getPrivateSubnetCidrBlocks(
    cidrPrefix: string,
    privateSubnetCount: number,
    netNumStart: number
) {
    const privateSubnetCidrBlocks: string[] = [];

    for (let index = 0; index < privateSubnetCount; index++) {
        privateSubnetCidrBlocks[index] = Fn.cidrsubnet(cidrPrefix, 8, netNumStart + index);
    }

    return privateSubnetCidrBlocks;
}
