#!/usr/bin/env node

var assert = require('assert');
var shelljs = require('shelljs');

var liferay_intellij = require('..');

assert(process.argv.length > 2, 'No workspace folder specified');

var portalSourceFolder = process.argv[2];

assert(shelljs.test('-d', portalSourceFolder), portalSourceFolder + ' is not a valid folder');

var pluginSourceFolders = [];

if (process.argv.length > 3) {
	pluginSourceFolders = process.argv.slice(3, process.argv.length);
}

liferay_intellij.createProject(portalSourceFolder, pluginSourceFolders);
