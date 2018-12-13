/*
* Create and export configuration variables
* 
*/

// Container for all the environments
const environments = {};

// Staging (default) environment

environments.staging = {
  'httpPort' : 3000,
  'httpsPort' : 3001,
  'envName' : 'staging',
  'hashingSecret' : 'thisIsASecret',
  'stripeKey' : 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
  'mailgunKey' : 'api:key-6392b1150b892cb0d46e99ce06517897',
};

// Production environment
environments.production = {
  'httpPort' : 5000,
  'httpsPort' : 5001,
  'envName' : 'production',
  'hashingSecret' : 'thisIsASecret',
};

// Determine which environment was passed asa command-line arguement
const currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// Check that the current environment is one of the environment above, if not default to staging
var environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;
 
// Export the module
module.exports = environmentToExport;