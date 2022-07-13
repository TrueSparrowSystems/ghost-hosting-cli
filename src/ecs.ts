import { Resource } from "cdktf";
import { Construct } from "constructs";

class Ecs extends Resource {
    options: {
        vpcId: string
    };

    constructor(scope: Construct, name: string, options: any) {
        super(scope, name);

        this.options = options;
    }

    async perform() {
        // Add here
    }
}

export { Ecs };
