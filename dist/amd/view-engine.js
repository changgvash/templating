define(['exports', 'core-js', 'aurelia-logging', 'aurelia-metadata', 'aurelia-loader', 'aurelia-dependency-injection', './view-compiler', './resource-registry', './module-analyzer'], function (exports, _coreJs, _aureliaLogging, _aureliaMetadata, _aureliaLoader, _aureliaDependencyInjection, _viewCompiler, _resourceRegistry, _moduleAnalyzer) {
  'use strict';

  var _interopRequire = function (obj) { return obj && obj.__esModule ? obj['default'] : obj; };

  var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

  exports.__esModule = true;

  var _core = _interopRequire(_coreJs);

  var logger = _aureliaLogging.getLogger('templating');

  function ensureRegistryEntry(loader, urlOrRegistryEntry) {
    if (urlOrRegistryEntry instanceof _aureliaLoader.TemplateRegistryEntry) {
      return Promise.resolve(urlOrRegistryEntry);
    }

    return loader.loadTemplate(urlOrRegistryEntry);
  }

  var ViewEngine = (function () {
    function ViewEngine(loader, container, viewCompiler, moduleAnalyzer, appResources) {
      _classCallCheck(this, ViewEngine);

      this.loader = loader;
      this.container = container;
      this.viewCompiler = viewCompiler;
      this.moduleAnalyzer = moduleAnalyzer;
      this.appResources = appResources;
    }

    ViewEngine.inject = function inject() {
      return [_aureliaLoader.Loader, _aureliaDependencyInjection.Container, _viewCompiler.ViewCompiler, _moduleAnalyzer.ModuleAnalyzer, _resourceRegistry.ResourceRegistry];
    };

    ViewEngine.prototype.loadViewFactory = function loadViewFactory(urlOrRegistryEntry, compileOptions, associatedModuleId) {
      var _this = this;

      return ensureRegistryEntry(this.loader, urlOrRegistryEntry).then(function (viewRegistryEntry) {
        if (viewRegistryEntry.isReady) {
          return viewRegistryEntry.factory;
        }

        return _this.loadTemplateResources(viewRegistryEntry, associatedModuleId).then(function (resources) {
          if (viewRegistryEntry.isReady) {
            return viewRegistryEntry.factory;
          }

          viewRegistryEntry.setResources(resources);

          var viewFactory = _this.viewCompiler.compile(viewRegistryEntry.template, resources, compileOptions);
          viewRegistryEntry.setFactory(viewFactory);
          return viewFactory;
        });
      });
    };

    ViewEngine.prototype.loadTemplateResources = function loadTemplateResources(viewRegistryEntry, associatedModuleId) {
      var resources = new _resourceRegistry.ViewResources(this.appResources, viewRegistryEntry.id),
          dependencies = viewRegistryEntry.dependencies,
          importIds,
          names;

      if (dependencies.length === 0 && !associatedModuleId) {
        return Promise.resolve(resources);
      }

      importIds = dependencies.map(function (x) {
        return x.src;
      });
      names = dependencies.map(function (x) {
        return x.name;
      });
      logger.debug('importing resources for ' + viewRegistryEntry.id, importIds);

      return this.importViewResources(importIds, names, resources, associatedModuleId);
    };

    ViewEngine.prototype.importViewModelResource = function importViewModelResource(moduleImport, moduleMember) {
      var _this2 = this;

      return this.loader.loadModule(moduleImport).then(function (viewModelModule) {
        var normalizedId = _aureliaMetadata.Origin.get(viewModelModule).moduleId,
            resourceModule = _this2.moduleAnalyzer.analyze(normalizedId, viewModelModule, moduleMember);

        if (!resourceModule.mainResource) {
          throw new Error('No view model found in module "' + moduleImport + '".');
        }

        resourceModule.analyze(_this2.container);

        return resourceModule.mainResource;
      });
    };

    ViewEngine.prototype.importViewResources = function importViewResources(moduleIds, names, resources, associatedModuleId) {
      var _this3 = this;

      return this.loader.loadAllModules(moduleIds).then(function (imports) {
        var i,
            ii,
            analysis,
            normalizedId,
            current,
            associatedModule,
            container = _this3.container,
            moduleAnalyzer = _this3.moduleAnalyzer,
            allAnalysis = new Array(imports.length);

        for (i = 0, ii = imports.length; i < ii; ++i) {
          current = imports[i];
          normalizedId = _aureliaMetadata.Origin.get(current).moduleId;

          analysis = moduleAnalyzer.analyze(normalizedId, current);
          analysis.analyze(container);
          analysis.register(resources, names[i]);

          allAnalysis[i] = analysis;
        }

        if (associatedModuleId) {
          associatedModule = moduleAnalyzer.getAnalysis(associatedModuleId);

          if (associatedModule) {
            associatedModule.register(resources);
          }
        }

        for (i = 0, ii = allAnalysis.length; i < ii; ++i) {
          allAnalysis[i] = allAnalysis[i].load(container);
        }

        return Promise.all(allAnalysis).then(function () {
          return resources;
        });
      });
    };

    return ViewEngine;
  })();

  exports.ViewEngine = ViewEngine;
});