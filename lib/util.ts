import { Fn } from "cdktf";

function getPublicSubnetCidrBlocks(cidrPrefix: string) {
    return [
        Fn.cidrsubnet(cidrPrefix, 6, 0),
        Fn.cidrsubnet(cidrPrefix, 6, 1)
    ]
}

function getPrivateSubnetCidrBlocks(cidrPrefix: string, privateSubnetCount: number) {
    const privateSubnetCidrBlocks: string[] = [];

    for (let index = 0; index < privateSubnetCount; index++) {
        privateSubnetCidrBlocks[index] = Fn.cidrsubnet(cidrPrefix, 6, 2 + index);
    }

    return privateSubnetCidrBlocks;
}

export { getPublicSubnetCidrBlocks, getPrivateSubnetCidrBlocks };

