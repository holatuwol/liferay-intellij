var fs = require('fs');
var highland = require('highland');
var path = require('path');
var streams2 = require('../streams2/streams2');
var streams3 = require('../streams4/streams3');
var util = require('util');

var getModuleExcludeFolders = streams3.getModuleExcludeFolders;
var getModuleIncludeFolders = streams3.getModuleIncludeFolders;
var getModuleOverview = streams3.getModuleOverview;
var getModuleVersion = streams3.getModuleVersion;

var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;

function getDependenciesWithWhileLoop(dependencyText, dependencyExtractor, dependencyRegex) {
	if (!dependencyRegex) {
		return [];
	}

	var matchResult = null;
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
	if (!dependencyRegex) {
		return [];
	}

	return dependencyText.split('\n')
		.map(RegExp.prototype.exec.bind(dependencyRegex))
		.map(dependencyExtractor)
		.filter(function(matchResult) {
			return matchResult !== null;
		});
};

function getVariableValue(seenVariables, buildGradleContents, variableName) {
	if (seenVariables.has(variableName)) {
		return '${' + variableName + '}';
	}

	seenVariables.add(variableName);

	var variableDeclaration = 'String ' + variableName + ' = "';

	var x = buildGradleContents.indexOf(variableDeclaration) + variableDeclaration.length;

	if (x < variableDeclaration.length) {
		console.log('missing', variableDeclaration);
		return null;
	}

	var y = buildGradleContents.indexOf('"', x);

	var rawValue = buildGradleContents.substring(x, y);

	return getStringInterpolatedValue(seenVariables, buildGradleContents, rawValue);
};

function getStringInterpolatedValue(seenVariables, buildGradleContents, rawValue) {
	var finalValue = rawValue;

	var matchResult = null;
	var stringInterpolationRegex = /\$\{([^}]*)\}/g;

	while ((matchResult = stringInterpolationRegex.exec(rawValue)) !== null) {
		var variableName = matchResult[1];
		var variableValue = getVariableValue(seenVariables, buildGradleContents, variableName);

		finalValue = finalValue.replace(matchResult[0], variableValue);
	}

	return finalValue;
}

function getLibraryDependency(buildGradleContents, matchResult) {
	if (matchResult == null) {
		return null;
	}

	var dependency = {
		type: 'library',
		group: matchResult[1],
		name: matchResult[2],
		version: (matchResult.length > 3) ? getStringInterpolatedValue(new Set(), buildGradleContents, matchResult[3]) : null,
		testScope: matchResult[0].indexOf('test') == 0
	};

	return dependency;
};

function getLibraryVariableDependency(buildGradleContents, matchResult) {
	if (matchResult == null) {
		return null;
	}

	var variableName = matchResult[3];
	var variableValue = getVariableValue(new Set(), buildGradleContents, variableName);

	var dependency = {
		type: 'library',
		group: matchResult[1],
		name: matchResult[2],
		version: variableValue,
		testScope: matchResult[0].indexOf('test') == 0
	};

	return dependency;
};

function getModuleDependencies(folder, moduleDependencies, dependencyManagementEnabled) {
	moduleDependencies = moduleDependencies || {};

	var buildGradlePath = path.join(folder, 'build.gradle');

	if (!isFile(buildGradlePath)) {
		return moduleDependencies;
	}

	if (!moduleDependencies.libraryDependencies) {
		moduleDependencies.libraryDependencies = [];
	}

	if (!moduleDependencies.projectDependencies) {
		moduleDependencies.projectDependencies = [];
	}

	var buildGradleContents = fs.readFileSync(buildGradlePath).toString();

	moduleDependencies.buildGradleContents = buildGradleContents;

	var dependencyTextRegex = /dependencies \{([\s\S]*?)\n\s*\}/g;
	var dependencyTextResult = null;

	var libraryDependencyRegex1 = /(?:test|compile|provided)[a-zA-Z]*[\s]*group *: *['"]([^'"]*)['"],[\s]*name *: *['"]([^'"]*)['"], [^\n]*version *: *['"]([^'"]*)['"]/;
	var libraryDependencyRegex2 = dependencyManagementEnabled ? /(?:test|compile|provided)[a-zA-Z]*[\s]*group *: *['"]([^'"]*)['"],[\s*]name *: *['"]([^'"]*)['"]$/ : null;
	var libraryDependencyRegex3 = /(?:test|compile|provided)[a-zA-Z]*\s*['"]([^'"]*):([^'"]*):([^'"]*)['"]/;
	var libraryDependencyRegex4 = /(?:test|compile|provided)[a-zA-Z]*[\s]*group *: *['"]([^'"]*)['"],[\s]*name *: *['"]([^'"]*)['"], [^\n]*version *: ([^'"]+)/;
	var projectDependencyRegex = /(?:test|compile|provided)[a-zA-Z]*[\s]*project\(['"]:(?:[^'"]*:)?([^'"]*)['"]/;

	while ((dependencyTextResult = dependencyTextRegex.exec(buildGradleContents)) !== null) {
		var dependencyText = dependencyTextResult[1];

		var getLibraryDependencies = highland.partial(getDependenciesWithStreams, dependencyText, highland.partial(getLibraryDependency, buildGradleContents));
		var getLibraryVariableDependencies = highland.partial(getDependenciesWithStreams, dependencyText, highland.partial(getLibraryVariableDependency, buildGradleContents));
		var getProjectDependencies = highland.partial(getDependenciesWithStreams, dependencyText, getProjectDependency);

		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex1));
		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex2));
		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex3));
		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryVariableDependencies(libraryDependencyRegex4));

		Array.prototype.push.apply(moduleDependencies.projectDependencies, getProjectDependencies(projectDependencyRegex));
	}

	if (folder.indexOf('modules/core/') == -1) {
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
	}

	return moduleDependencies;
};

function getModuleDetails(folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleVersion = getModuleVersion(folder);
	var moduleIncludeFolders = getModuleIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(folder, moduleIncludeFolders);
	var moduleDependencies = getModuleDependencies(folder, null, true);

	var archetypeResourcesFolder = path.join(folder, 'src/main/resources/archetype-resources');
	moduleDependencies = getModuleDependencies(archetypeResourcesFolder, moduleDependencies, false);

	var moduleDetailsArray = [moduleOverview, moduleVersion, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

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
exports.getLibraryVariableDependency = getLibraryVariableDependency;
exports.getModuleDetails = getModuleDetails;