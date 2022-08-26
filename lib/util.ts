import { Fn } from "cdktf";
import * as Psl from "psl";

/**
 * @dev Get public subnet cidr blocks for the cidr prefix provided
 *
 * @param {string} cidrPrefix
 */
export function getPublicSubnetCidrBlocks(cidrPrefix: string): string[] {
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
): string[] {
    const privateSubnetCidrBlocks: string[] = [];

    for (let index = 0; index < privateSubnetCount; index++) {
        privateSubnetCidrBlocks[index] = Fn.cidrsubnet(
            cidrPrefix,
            8,
            netNumStart + index
        );
    }

    return privateSubnetCidrBlocks;
}

export function getRootDomainFromUrl(url: string): string | null {
    const domain = url.split('://')[1].split('/')[0];
    return Psl.get(domain);
}

export function getDomainFromUrl(url: string): string {
    return url.split('://')[1].split('/')[0];
}

export function getPathSuffixFromUrl(url: string): string {
    const urlParts = url.split('://')[1].split('/');
    return urlParts.slice(1).join("/");
}
