import { Fn } from "cdktf";

function getDefaultCidrBlock(cidrPrefix: string) {
    return Fn.cidrsubnet(cidrPrefix, 8, 0);
}

function getPublicSubnetCidrBlocks(cidrPrefix: string) {
    return [
        Fn.cidrsubnet(cidrPrefix, 8, 0),
        Fn.cidrsubnet(cidrPrefix, 8, 1)
    ]
}

function getPrivateSubnetCidrBlocks(cidrPrefix: string, privateSubnetCount: number, netNumStart: number) {
    const privateSubnetCidrBlocks: string[] = [];

    for (let index = 0; index < privateSubnetCount; index++) {
        privateSubnetCidrBlocks[index] = Fn.cidrsubnet(cidrPrefix, 8, netNumStart + index);
    }

    return privateSubnetCidrBlocks;
}

export { getPublicSubnetCidrBlocks, getPrivateSubnetCidrBlocks, getDefaultCidrBlock };
