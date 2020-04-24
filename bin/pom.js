#!/usr/bin/env node

var assert = require('assert');
var minimist = require('minimist');

var isDirectory = require('../streams2/streams2').isDirectory;
var liferay_intellij = require('..');

assert(process.argv.length > 2, 'No portal source folder specified');

var argv = minimist(process.argv.slice(2), {boolean: ['complete-cache', 'ic', 'mvn-cache', 'unload', 'unzip']});

var portalSourceFolder = argv._[0];

assert(isDirectory(portalSourceFolder), portalSourceFolder + ' is not a valid folder');

var otherSourceFolders = [];

if (process.argv.length > 3) {
	otherSourceFolders = argv._.slice(1, argv._.length);

	for (var i = 0; i < otherSourceFolders.length; i++) {
		assert(isDirectory(otherSourceFolders[i]), otherSourceFolders[i] + ' is not a valid folder');
	}
}

liferay_intellij.prepareProject(portalSourceFolder, otherSourceFolders, argv);
