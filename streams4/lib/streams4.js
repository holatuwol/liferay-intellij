var streams2 = require('./streams2');
var streams3 = require('./streams3');
var util = require('util');

var getModuleDependencies = streams3.getModuleDependencies;
var getModuleExcludeFolders = streams3.getModuleExcludeFolders;
var getModuleFolders = streams3.getModuleFolders;
var getModuleIncludeFolders = streams3.getModuleIncludeFolders;
var getModuleOverview = streams3.getModuleOverview;

function getModuleDetails(folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleIncludeFolders = getModuleIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(moduleIncludeFolders);
	var moduleDependencies = getModuleDependencies(folder);

	var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {});
};

exports.getModuleFolders = getModuleFolders;
exports.getModuleDetails = getModuleDetails;