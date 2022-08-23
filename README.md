# ghost-cli

# Steps to run:

## Clone the repository:
```
$ git clone git@github.com:PLG-Works/ghost-hosting-cli.git

$ cd ghost-hosting-cli
```

## Install required node modules
```
npm install
```

## Use cdktf-cli to fetch required terraform providers and modules
```
cdktf get
```

## Create a sym-link for the project
```
npm link
```

Now you can use `plg-gh` to orchestrate your ghost-aws infrastructure
