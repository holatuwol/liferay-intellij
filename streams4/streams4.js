var fs = require('fs');
var highland = require('highland');
var path = require('path');
var streams2 = require('../streams2/streams2');
var streams3 = require('./streams3');
var util = require('util');

var getModuleExcludeFolders = streams3.getModuleExcludeFolders;
var getModuleFolders = streams3.getModuleFolders;
var getModuleIncludeFolders = streams3.getModuleIncludeFolders;
var getModuleOverview = streams3.getModuleOverview;

var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;

function getModuleDependencies(folder) {
	return {
		libraryDependencies: [],
		projectDependencies: []
	};
};

function getModuleDetails(folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleIncludeFolders = getModuleIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(folder, moduleIncludeFolders);
	var moduleDependencies = getModuleDependencies(folder);

	var archetypeResourcesFolder = path.join(folder, 'src/main/resources/archetype-resources');
	moduleDependencies = getModuleDependencies(archetypeResourcesFolder, moduleDependencies);

	var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {});
};

exports.getModuleFolders = getModuleFolders;
exports.getModuleDetails = getModuleDetails;