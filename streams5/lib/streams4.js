var fs = require('fs');
var highland = require('highland');
var path = require('path');
var streams2 = require('./streams2');
var streams3 = require('./streams3');
var util = require('util');

var getModuleExcludeFolders = streams3.getModuleExcludeFolders;
var getModuleIncludeFolders = streams3.getModuleIncludeFolders;
var getModuleOverview = streams3.getModuleOverview;

var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;

function getDependenciesWithWhileLoop(dependencyText, dependencyExtractor, dependencyRegex) {
	var dependencies = [];

	while ((matchResult = dependencyRegex.exec(dependencyText)) !== null) {
		var dependency = dependencyExtractor(matchResult);

		if (dependency !== null) {
			dependencies.push(dependency);
		}
	}

	return dependencies;
};

function getDependenciesWithStreams(dependencyText, dependencyExtractor, dependencyRegex) {
	return dependencyText.split('\n')
		.map(RegExp.prototype.exec.bind(dependencyRegex))
		.map(dependencyExtractor)
		.filter(function(matchResult) {
			return matchResult !== null;
		});
};

function getLibraryDependency(matchResult) {
	if (matchResult == null) {
		return null;
	}

	var dependency = {
		type: 'library',
		group: matchResult[1],
		name: matchResult[2],
		version: matchResult[3]
	};

	return dependency;
};

function getModuleDependencies(folder) {
	var buildGradlePath = path.join(folder, 'build.gradle');

	if (!isFile(buildGradlePath)) {
		return {};
	}

	var buildGradleContents = fs.readFileSync(buildGradlePath);

	var dependencyTextRegex = /dependencies \{([\s\S]*?)\n\s*\}/g;
	var dependencyTextResult = null;

	var moduleDependencies = {
		libraryDependencies: [],
		projectDependencies: []
	};

	var libraryDependencyRegex1 = /(?:test|compile|provided)[^\n]*\sgroup: ['"]([^'"]*)['"], name: ['"]([^'"]*)['"], [^\n]*version: ['"]([^'"]*)['"]/;
	var libraryDependencyRegex2 = /(?:test|compile|provided)[^\n]*\s['"]([^'"]*):([^'"]*):([^'"]*)['"]/;
	var projectDependencyRegex = /\sproject\(['"]:(?:[^'"]*:)?([^'"]*)['"]/;

	while ((dependencyTextResult = dependencyTextRegex.exec(buildGradleContents)) !== null) {
		var dependencyText = dependencyTextResult[1];

		var getLibraryDependencies = highland.partial(getDependenciesWithStreams, dependencyText, getLibraryDependency);
		var getProjectDependencies = highland.partial(getDependenciesWithStreams, dependencyText, getProjectDependency);

		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex1));
		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex2));

		Array.prototype.push.apply(moduleDependencies.projectDependencies, getProjectDependencies(projectDependencyRegex));
	}

	if (isDirectory(path.join(folder, 'src/test')) ||
		isDirectory(path.join(folder, 'src/testIntegration'))) {

		moduleDependencies.projectDependencies.push({
			type: 'project',
			name: 'portal-test'
		});
	}

	if (isDirectory(path.join(folder, 'src/testIntegration'))) {
		moduleDependencies.projectDependencies.push({
			type: 'project',
			name: 'portal-test-integration'
		});
	}

	return moduleDependencies;
};

function getModuleDetails(folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleIncludeFolders = getModuleIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(folder, moduleIncludeFolders);
	var moduleDependencies = getModuleDependencies(folder);

	var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {});
};

function getProjectDependency(matchResult) {
	if (matchResult == null) {
		return null;
	}

	var dependency = {
		type: 'project',
		name: matchResult[1]
	};

	return dependency;
};

exports.getDependenciesWithWhileLoop = getDependenciesWithWhileLoop;
exports.getDependenciesWithStreams = getDependenciesWithStreams;
exports.getLibraryDependency = getLibraryDependency;
exports.getModuleDetails = getModuleDetails;