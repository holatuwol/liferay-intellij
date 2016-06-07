#!/usr/bin/env node

var assert = require('assert');
var shelljs = require('shelljs');

var liferay_intellij = require('..');

assert(process.argv.length > 2, 'No portal source folder specified');

var portalSourceFolder = process.argv[2];

assert(shelljs.test('-d', portalSourceFolder), portalSourceFolder + ' is not a valid folder');

var otherSourceFolders = [];

if (process.argv.length > 3) {
	otherSourceFolders = process.argv.slice(3, process.argv.length);

	for (var i = 0; i < otherSourceFolders.length; i++) {
		assert(shelljs.test('-d', otherSourceFolders[i]), otherSourceFolders[i] + ' is not a valid folder');
	}
}

liferay_intellij.prepareProject(portalSourceFolder, otherSourceFolders);
