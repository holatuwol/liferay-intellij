var highland = require('highland');
var streams2 = require('../streams2/streams2')
var streams6 = require('./streams6');

var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getIntellijXML = streams6.getIntellijXML;
var getSourceFolderElement = streams6.getSourceFolderElement;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var saveContent = streams6.saveContent;

function createProjectWorkspace(coreDetails, moduleDetails) {
	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);

	var detailsStream = highland.merge([moduleStream, coreStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();

	moduleFilesStream
		.map(getModuleXML)
		.map(getIntellijXML)
		.each(saveContent);

	detailsStream.done(function() {});
};

function getAncestorFiles(folder, filename) {
	var ancestorFiles = [];

	var basename = '';

	while ((basename != '.') && (basename != '..')) {
		var filePath = getFilePath(folder, filename);

		if (isFile(filePath) || isDirectory(filePath)) {
			ancestorFiles.push(filePath);
		}

		folder = path.dirname(folder);
		basename = path.basename(folder);
	}

	if ((basename != '..') && (isFile(filename) || isDirectory(filename))) {
		ancestorFiles.push(filename);
	}

	return ancestorFiles;
};

function getModuleGroupName(module) {
	if (module.type == 'portal') {
		return 'portal';
	}

	var pos = module.modulePath.indexOf('modules/') == 0 ? 0 : module.modulePath.indexOf('/modules/');

	if (pos != -1) {
		var modulesRoot = module.modulePath.substring(0, pos);

		if (modulesRoot == '') {
			return path.dirname(module.modulePath);
		}

		var modulesRootParent = path.dirname(modulesRoot);
		var moduleRelativePath = module.modulePath.substring(modulesRootParent.length + 1);
		return path.dirname(moduleRelativePath);
	}

	var gradlePropertiesPaths = getAncestorFiles(module.modulePath, 'gradle.properties');

	for (var i = 0; i < gradlePropertiesPaths.length; i++) {
		var gradlePropertiesContent = fs.readFileSync(gradlePropertiesPaths[i]);

		var projectPrefixRegex = /project.path.prefix=:(.*)/g;
		var matchResult = projectPrefixRegex.exec(gradlePropertiesContent);

		if (matchResult) {
			return 'subrepo/' + matchResult[1].split(':').join('/');
		}
	}

	var gradlePaths = getAncestorFiles(module.modulePath, 'gradlew');

	if (gradlePaths.length > 0) {
		var pos = gradlePaths[gradlePaths.length - 1].lastIndexOf('/');

		if (pos != -1) {
			var modulesRoot = module.modulePath.substring(0, pos);

			var modulesRootParent = path.dirname(modulesRoot);
			var moduleRelativePath = module.modulePath.substring(modulesRootParent.length + 1);
			return path.dirname(moduleRelativePath);
		}
	}

	console.warn('Unable to detect group for ' + module.modulePath);

	return '';
};

function getModuleXML(module) {
	return {
		fileName: getModuleIMLPath(module),
		components: [
			{
				name: 'NewModuleRootManager',
				content: getNewModuleRootManagerXML(module)
			},
			{
				name: 'FacetManager',
				content: getFacetManagerXML(module)
			}
		]
	};
};

function getNewModuleRootManagerXML(module) {
	var newModuleRootManagerXML = [streams6.getNewModuleRootManagerXML(module)];

	if (module.projectDependencies) {
		// TODO: Perform work on module.projectDependencies here
	}

	return newModuleRootManagerXML.join('\n');
};

exports.createProjectWorkspace = createProjectWorkspace;
exports.getAncestorFiles = getAncestorFiles;