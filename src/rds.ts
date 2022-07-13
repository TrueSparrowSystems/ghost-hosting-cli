import { Resource } from "cdktf";
import { Construct } from "constructs";

class Rds extends Resource {
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

export { Rds };
