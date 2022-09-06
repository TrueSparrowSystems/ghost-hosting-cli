import { Fn } from 'cdktf';
import * as Psl from 'psl';

/**
 * @dev Get public subnet cidr blocks for the cidr prefix provided
 *
 * @param {string} cidrPrefix
 * @returns {string[]} - list of subnet cidr blocks
 */
export function getPublicSubnetCidrBlocks(cidrPrefix: string): string[] {
  return [Fn.cidrsubnet(cidrPrefix, 8, 0), Fn.cidrsubnet(cidrPrefix, 8, 1)];
}

/**
 * @dev Get public subnet cidr blocks for the cidr prefix provided
 *
 * @param {string} cidrPrefix
 * @param {number} privateSubnetCount
 * @param {number} netNumStart
 * @returns {string[]} - list of subnet cidr blocks
 */
export function getPrivateSubnetCidrBlocks(
  cidrPrefix: string,
  privateSubnetCount: number,
  netNumStart: number
): string[] {
  const privateSubnetCidrBlocks: string[] = [];

  for (let index = 0; index < privateSubnetCount; index++) {
    privateSubnetCidrBlocks[index] = Fn.cidrsubnet(cidrPrefix, 8, netNumStart + index);
  }

  return privateSubnetCidrBlocks;
}

/**
 * @dev Get root domain from the url provided
 *
 * @param url - host url
 * @returns {string} - parsed domain from the url
 */
export function getRootDomainFromUrl(url: string): string | null {
  const domain = url.split('://')[1].split('/')[0];
  return Psl.get(domain);
}

/**
 * @dev Get domain from the url
 *
 * @param url - host url
 * @returns {string} - domain extracted from the url
 */
export function getDomainFromUrl(url: string): string {
  return url.split('://')[1].split('/')[0];
}

/**
 * @dev Get path suffix from the url
 *
 * @param url - host url
 * @returns {string} - path suffix extracted from the url
 */
export function getPathSuffixFromUrl(url: string): string {
  const urlParts = url.split('://')[1].split('/');
  return urlParts.slice(1).join('/');
}
