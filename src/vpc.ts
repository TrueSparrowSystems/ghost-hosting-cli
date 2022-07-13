import { Resource } from "cdktf";
import { Construct } from "constructs";

class Vpc extends Resource {
    options: {};

    constructor(scope: Construct, name: string, options: any) {
        super(scope, name);

        this.options = options;
    }

    async perform() {
        // Add here
    }
}

export { Vpc };
