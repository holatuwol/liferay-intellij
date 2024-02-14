var fs = require('fs');
var highland = require('highland');
var path = require('path');
var streams2 = require('../streams2/streams2');
var streams3 = require('../streams4/streams3');
var util = require('util');

var getFilePath = streams2.getFilePath;
var getModuleExcludeFolders = streams3.getModuleExcludeFolders;
var getModuleIncludeFolders = streams3.getModuleIncludeFolders;
var getModuleOverview = streams3.getModuleOverview;
var getModuleVersion = streams3.getModuleVersion;

var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;

var buildGradleCache = {};

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

function getBuildGradle(folder) {
	var buildGradlePath = getFilePath(folder, 'build.gradle');

	if (buildGradlePath in buildGradleCache) {
		return buildGradleCache[buildGradlePath];
	}

	if (!isFile(buildGradlePath)) {
		buildGradleCache[buildGradlePath] = null;

		return null;
	}

	var buildGradleContents = fs.readFileSync(buildGradlePath).toString();

	buildGradleCache[buildGradlePath] = buildGradleContents;

	return buildGradleContents;
}

function getBuildExtGradle(folder) {
	var buildExtGradlePath = getFilePath(folder, 'build-ext.gradle');

	if (buildExtGradlePath in buildGradleCache) {
		return buildGradleCache[buildExtGradlePath];
	}

	if (!isFile(buildExtGradlePath)) {
		buildGradleCache[buildExtGradlePath] = null;

		return null;
	}

	var buildGradleContents = fs.readFileSync(buildExtGradlePath).toString();

	buildGradleCache[buildExtGradlePath] = buildGradleContents;

	return buildGradleContents;
}

function getVariableValue(seenVariables, folder, variableName) {
	if (seenVariables.has(variableName)) {
		return '${' + variableName + '}';
	}

	var variableNameRegExp = new RegExp('^[a-zA-Z0-9]*$', 'g');

	if (!variableNameRegExp.exec(variableName)) {
		return null;
	}

	var variableDeclaration = new RegExp(variableName + '\\s*=\\s*"([^"]*)');

	var content = getBuildGradle(folder);

	if (content == null) {
		return null;
	}

	content += '\n' + (getBuildExtGradle(folder) || '');

	var variableMatcher = variableDeclaration.exec(content);

	var rawValue = null;

	if (variableMatcher == null) {
		rawValue = getVariableValue(seenVariables, path.dirname(folder), variableName);

		if (rawValue == null) {
			console.log('missing', variableName, 'from', folder);

			return null;
		}
	}
	else {
		rawValue = variableMatcher[1];
	}

	seenVariables.add(variableName);

	return getStringInterpolatedValue(seenVariables, folder, rawValue);
};

function getStringInterpolatedValue(seenVariables, folder, rawValue) {
	var finalValue = rawValue;

	var matchResult = null;
	var stringInterpolationRegex = /\$\{([^}]*)\}/g;

	while ((matchResult = stringInterpolationRegex.exec(rawValue)) !== null) {
		var variableName = matchResult[1];
		var variableValue = getVariableValue(seenVariables, folder, variableName);

		finalValue = finalValue.replace(matchResult[0], variableValue);
	}

	return finalValue;
}

function getLibraryDependency(folder, matchResult) {
	if (matchResult == null) {
		return null;
	}

	var dependency = {
		type: 'library',
		group: matchResult[1],
		name: matchResult[2],
		version: (matchResult.length > 3) ? getStringInterpolatedValue(new Set(), folder, matchResult[3]) : null,
		testScope: matchResult[0].indexOf('test') == 0
	};

	return dependency;
};

function getLibraryVariableDependency(folder, matchResult) {
	if (matchResult == null) {
		return null;
	}

	var variableName = matchResult[3];
	var variableValue = getVariableValue(new Set(), folder, variableName);

	var dependency = {
		type: 'library',
		group: matchResult[1],
		name: matchResult[2],
		version: variableValue,
		testScope: matchResult[0].indexOf('test') == 0
	};

	return dependency;
};

function getDependencyText(buildGradleContents, nextStartPos) {
	var marker = 'dependencies {';

	var startPos = buildGradleContents.indexOf(marker, nextStartPos);

	if (startPos == -1) {
		return null;
	}

	var openCount = 1;
	var endPos = -1;

	for (var i = startPos + marker.length; i < buildGradleContents.length; i++) {
		var ch = buildGradleContents[i];
		switch (ch) {
		case '{':
			openCount++;
			break;
		case '}':
			openCount--;
			break;
		}

		if (openCount == 0) {
			endPos = i;
			break;
		}
	}

	if (endPos == -1) {
		return null;
	}

	var dependencyText = buildGradleContents.substring(startPos, endPos);

	return {
		'text': dependencyText,
		'startPos': startPos,
		'endPos': endPos
	};
};

function getModuleDependencies(folder, moduleDependencies, dependencyManagementEnabled) {
	moduleDependencies = moduleDependencies || {};

	if (!moduleDependencies.libraryDependencies) {
		moduleDependencies.libraryDependencies = [];
	}

	if (!moduleDependencies.projectDependencies) {
		moduleDependencies.projectDependencies = [];
	}

	var buildGradleContents = getBuildGradle(folder);

	if (buildGradleContents == null) {
		return moduleDependencies;
	}

	moduleDependencies.buildGradleContents = buildGradleContents;

	var libraryDependencyRegex1 = /(?:test|api|compile|provided)[a-zA-Z]*[\s]*group *: *['"]([^'"]*)['"],[\s]*name *: *['"]([^'"]*)['"], [^\n]*version *: *['"]([^'"]*)['"]/;
	var libraryDependencyRegex2 = dependencyManagementEnabled ? /(?:test|api|compile|provided)[a-zA-Z]*[\s]*group *: *['"]([^'"]*)['"],[\s*]name *: *['"]([^'"]*)['"]$/ : null;
	var libraryDependencyRegex3 = /(?:test|api|compile|provided)[a-zA-Z]*\s*['"]([^'"]*):([^'"]*):([^'"]*)['"]/;
	var libraryDependencyRegex4 = /(?:test|api|compile|provided)[a-zA-Z]*[\s]*group *: *['"]([^'"]*)['"],[\s]*name *: *['"]([^'"]*)['"], [^\n]*version *: ([^'"]+)/;
	var projectDependencyRegex = /(?:test|api|compile|provided)[a-zA-Z]*[\s]*project\(['"]:(?:[^'"]*:)?([^'"]*)['"]/;

	var nextStartPos = 0;
	var dependencyTextResult = null;

	while ((dependencyTextResult = getDependencyText(buildGradleContents, nextStartPos)) !== null) {
		var dependencyText = dependencyTextResult.text;

		nextStartPos = dependencyTextResult.endPos;

		var getLibraryDependencies = highland.partial(getDependenciesWithStreams, dependencyText, highland.partial(getLibraryDependency, folder));
		var getLibraryVariableDependencies = highland.partial(getDependenciesWithStreams, dependencyText, highland.partial(getLibraryVariableDependency, folder));
		var getProjectDependencies = highland.partial(getDependenciesWithStreams, dependencyText, getProjectDependency);

		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex1));
		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex2));
		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryDependencies(libraryDependencyRegex3));
		Array.prototype.push.apply(moduleDependencies.libraryDependencies, getLibraryVariableDependencies(libraryDependencyRegex4));

		Array.prototype.push.apply(moduleDependencies.projectDependencies, getProjectDependencies(projectDependencyRegex));
	}

	if (folder.indexOf('modules/core/') == -1) {
		if (isDirectory(getFilePath(folder, 'src/test')) ||
			isDirectory(getFilePath(folder, 'src/testIntegration'))) {

			moduleDependencies.projectDependencies.push({
				type: 'project',
				name: 'portal-test'
			});
		}

		if (isDirectory(getFilePath(folder, 'src/testIntegration'))) {
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

	var archetypeResourcesFolder = getFilePath(folder, 'src/main/resources/archetype-resources');
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