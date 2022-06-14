import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { readInput } from "../lib/readInput";

class MyStack extends TerraformStack {
    userInput: object;
    constructor(scope: Construct, name: string) {
        super(scope, name);

        this.userInput = {};
    }

    async perform() {
        this.userInput = readInput();
    }
}

const app = new App();
new MyStack(app, "ghost-hosting-cli")
    .perform()
    .then(() => {
        // add logic here
    });
app.synth();
