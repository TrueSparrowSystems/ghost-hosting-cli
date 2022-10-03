# Ghost Hosting  CLI
Ghost hosting cli is a command line interactive tool to host the [Ghost](https://ghost.org/) on the AWS cloud with the help of [Terraform-CDK](https://www.terraform.io/cdktf). It simplifies the Ghost server deployment by utilizing the AWS infrastructure. It provides the flexibility to host the fresh stack or to plug it into the existing infrastructure.

## Prerequisites
- Terraform >= 1.2.5
- NodeJS >= 14.17
- AWS account with admin access

## How does it work? 

Ghost Hosting CLI uses AWS cloud platform, the following parameters are required by default. 
* `AWS access key`
* `AWS secret access key`
* `AWS region`

It requires a `config.json` file. This `config.json` is get's generated while taking input from the user. If this file is already present at the location (from previous deployments), the CLI prompt ask user whether to use the existing configuration or to create new. 

Configuration file generation happens only in the deploy stage. Once the `config.json` file is ready, the CLI synthesizes Terraform configuration for an application.

After this, rest is handled by terraform to deploy/destroy stacks. 

For the deployment, CLI create two stacks:
- **Backend stack**: S3 backend is used to provide state locking and consistency checking. S3 bucket is used to store the generated state files by the terraform and Dynamo DB table is used for the locking purpose. 
- **Ghost stack**: Once the backend stack is deployed, the deployment for the Ghost stack begins. Changes in the infrastructure plan will be shown to user before deploying/destroying the stack.

Terraform CDK then utilizes the providers and modules specified to generate terraform configuration. This terraform configuration later used for deploying/destroying stacks.

### Provides flexibility with: 
1. **Existing VPC**: You can use the existing VPC by providing subnet ids as comma-separated values otherwise it'll create the new VPC and the subnets.
It expects to have Route53 configured for the domain where you want to host the Ghost. If you want to use the existing VPC, you need to provide the `subnet ids` to launch the ECS tasks (recommend private subnets) and `public subnet ids` to launch the load balancer (ALB). 
2. **Existing Load Balancer**: You can use the existing load balancer (ALB) by providing the `load balancer listener ARN`.
3. **Hosting URL**: It requires a `Ghost hosting url` where Ghost can be accessed on the web.
4. **Static Website**: Refer [this](https://github.com/PLG-Works/ghost-static-website-generator) to host the static website for the generated content. You can also specify `Static website url` where it will provision the AWS S3 bucket to host the static website.
5. **Existing MySQL Database**: The cli requires a MySQL database to store the Ghost configurations along with the content. You can provide the existing DB credentials like DB host, DB name, DB user password, and database name. (otherwise it'll create a new RDS instance).

## Why do I need to use this tool?
It comes with the following benefits:
- Easy setup. You don't have to worry about provisioning each of the AWS resources by yourself.
- Make use of the existing infrastructure by providing the existing VPC subnets, load balancer, and database.
- Use this setup to provision and host the static website for the generated content.
- It uses AWS ECS with auto-scaling enabled. So, you don't have to worry about scalability.
- It provides a cost-efficient setup by plugging the existing load balancer and database. Also, it runs on AWS `FARGATE` and utilizes the `FARGATE SPOT` resources.

## Example Usage:

- Install the package:
  ```bash
  npm install -g plg-ghost
  ```
- Deploy Ghost Stack and Backend Stack:
    ```bash
    plg-ghost deploy
    ```

- Destroy Ghost and Backend Stack:
    ```bash
    plg-ghost destroy
    ```

## Development:
- Clone the repository:
    ```bash
    git clone git@github.com:PLG-Works/ghost-hosting-cli.git
    ```
- Install all dependencies:
    ```bash
    cd ghost-hosting-cli
    npm install 
    ```
- Create build
    ```bash
    npm run get # fetch required terraform providers and modules
    npm run build # create a build
    ```
    or
    ```bash
    npm run watch
    ```
- Deploy stacks
    ```bash
    npm run dev -- deploy
    ```
- Destroy stacks
    ```bash
    npm run dev -- destroy
    ```

> While executing **deploy**/**destroy** command, you might get timeout exceptions because of network interruptions. If that is the case, then re-run the command to complete the execution.