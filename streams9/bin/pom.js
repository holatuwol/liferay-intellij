#!/usr/bin/env node

var assert = require('assert');
var shelljs = require('shelljs');

var liferay_intellij = require('..');

assert(process.argv.length > 2, 'No portal source folder specified');

var portalSourceFolder = process.argv[2];

assert(shelljs.test('-d', portalSourceFolder), portalSourceFolder + ' is not a valid folder');

liferay_intellij.createProjectObjectModels(portalSourceFolder);
