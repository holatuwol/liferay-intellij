#!/usr/bin/env node

var assert = require('assert');
var shelljs = require('shelljs');

var liferay_intellij = require('..');

assert(process.argv.length > 2, 'No workspace folder specified');

var workspaceFolder = process.argv[2];

assert(shelljs.test('-d', workspaceFolder), workspaceFolder + ' is not a valid folder');

liferay_intellij.createProject(workspaceFolder);
