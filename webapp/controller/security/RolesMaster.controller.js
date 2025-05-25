sap.ui.define([
  "com/invertions/sapfiorimodinv/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/base/Log",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/core/Fragment"
], function (
  BaseController,
  JSONModel,
  Log,
  MessageToast,
  MessageBox,
  Filter,
  FilterOperator,
  Fragment
) {
  "use strict";

  return BaseController.extend("com.invertions.sapfiorimodinv.controller.security.RolesMaster", {

    onInit: function () {
      this._catalogsLoaded = false;
      this.initModels();

      const oRouter = this.getRouter();
      oRouter.getRoute("RouteRolesMaster").attachPatternMatched(this._onRouteMatched, this);

      if (!this._pDialog) {
        this._pDialog = Fragment.load({
          name: "com.invertions.sapfiorimodinv.view.security.fragments.AddRoleDialog",
          controller: this
        }).then(function (oDialog) {
          this.getView().addDependent(oDialog);
          return oDialog;
        }.bind(this));
      }
    },

    _onRouteMatched: function () {
      this.loadRolesData();
    },

    initModels: function () {
      const view = this.getView();
      view.setModel(new JSONModel(), "selectedRole");

      view.setModel(new JSONModel({
        ROLEID: "",
        ROLENAME: "",
        DESCRIPTION: "",
        NEW_PROCESSID: "",
        NEW_PRIVILEGES: [],
        PRIVILEGES: []
      }), "newRoleModel");
    },

    loadCatalogsOnce: async function () {
      if (!this._catalogsLoaded) {
        await this.loadCatalog("IdProcesses", "processCatalogModel");
        await this.loadCatalog("IdPrivileges", "privilegeCatalogModel");
        this._catalogsLoaded = true;
      }
    },

    onOpenDialog: async function () {
      await this.loadCatalogsOnce();

      this.getView().getModel("newRoleModel").setData({
        ROLEID: "",
        ROLENAME: "",
        DESCRIPTION: "",
        NEW_PROCESSID: "",
        NEW_PRIVILEGES: [],
        PRIVILEGES: []
      });

      this._pDialog.then(function (oDialog) {
        oDialog.setTitle("Crear Rol");
        oDialog.open();
      });
    },

    onDialogClose: function () {
      this._pDialog.then(function (oDialog) {
        oDialog.close();
      });
    },

    onAddPrivilege: function () {
      const oModel = this.getView().getModel("newRoleModel");
      const oData = oModel.getData();

      if (!oData.NEW_PROCESSID || !Array.isArray(oData.NEW_PRIVILEGES) || oData.NEW_PRIVILEGES.length === 0) {
        MessageToast.show("Selecciona proceso y al menos un privilegio.");
        return;
      }

      oData.PRIVILEGES.push({
        PROCESSID: oData.NEW_PROCESSID,
        PRIVILEGEID: oData.NEW_PRIVILEGES
      });

      oData.NEW_PROCESSID = "";
      oData.NEW_PRIVILEGES = [];
      oModel.setData(oData);
    },

    onSaveRole: async function () {
      const oView = this.getView();
      const oData = oView.getModel("newRoleModel").getData();

      if (!oData.ROLEID || !oData.ROLENAME) {
        MessageToast.show("ID y Nombre del Rol son obligatorios.");
        return;
      }

      try {
        const response = await fetch("http://localhost:4004/api/sec/rolesCRUD?procedure=post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ROLEID: oData.ROLEID,
            ROLENAME: oData.ROLENAME,
            DESCRIPTION: oData.DESCRIPTION,
            PRIVILEGES: oData.PRIVILEGES
          })
        });

        if (!response.ok) throw new Error(await response.text());

        MessageToast.show("Rol guardado correctamente.");
        this._pDialog.then(function (oDialog) {
          oDialog.close();
        });

        // Agregar el nuevo rol directamente al modelo sin hacer otro GET
        const oRolesModel = this.getOwnerComponent().getModel("roles");
        const aAllRoles = oRolesModel.getProperty("/valueAll") || [];

        const oNewRole = {
          ROLEID: oData.ROLEID,
          ROLENAME: oData.ROLENAME,
          DESCRIPTION: oData.DESCRIPTION,
          PRIVILEGES: oData.PRIVILEGES,
          DETAIL_ROW: {
            ACTIVED: true,
            DELETED: false
          }
        };

        aAllRoles.push(oNewRole);

        let aFiltered = [];
        const sFilterKey = oRolesModel.getProperty("/filterKey");

        switch (sFilterKey) {
          case "active":
            aFiltered = aAllRoles.filter(r => r.DETAIL_ROW?.ACTIVED && !r.DETAIL_ROW?.DELETED);
            break;
          case "inactive":
            aFiltered = aAllRoles.filter(r => !r.DETAIL_ROW?.ACTIVED && !r.DETAIL_ROW?.DELETED);
            break;
          default:
            aFiltered = aAllRoles.filter(r => !r.DETAIL_ROW?.DELETED);
        }

        oRolesModel.setProperty("/valueAll", aAllRoles);
        oRolesModel.setProperty("/value", aFiltered);

      } catch (err) {
        MessageBox.error("Error al guardar el rol: " + err.message);
      }
    },

    loadRolesData: async function () {
      try {
        const response = await fetch("http://localhost:4004/api/sec/rolesCRUD?procedure=get&type=all", {
          method: "POST"
        });
        const data = await response.json();

        const aAllRoles = (data.value || []).filter(role => role.DETAIL_ROW?.DELETED === false);
        const aFiltered = aAllRoles.filter(role => role.DETAIL_ROW?.ACTIVED === true);

        const oRolesModel = new JSONModel({
          value: aFiltered,
          valueAll: aAllRoles,
          filterKey: "active"
        });

        this.getOwnerComponent().setModel(oRolesModel, "roles");
      } catch (error) {
        Log.error("Error al cargar roles", error);
      }
    },

    onStatusFilterChange: function (oEvent) {
      const sKey = oEvent.getSource().getSelectedKey();
      const oRolesModel = this.getOwnerComponent().getModel("roles");
      const aAllRoles = oRolesModel.getProperty("/valueAll") || [];

      let aFiltered = [];

      switch (sKey) {
        case "active":
          aFiltered = aAllRoles.filter(r => r.DETAIL_ROW?.ACTIVED === true && r.DETAIL_ROW?.DELETED === false);
          break;
        case "inactive":
          aFiltered = aAllRoles.filter(r => r.DETAIL_ROW?.ACTIVED === false && r.DETAIL_ROW?.DELETED === false);
          break;
        default:
          aFiltered = aAllRoles.filter(r => r.DETAIL_ROW?.DELETED === false);
      }

      oRolesModel.setProperty("/value", aFiltered);
      oRolesModel.setProperty("/filterKey", sKey);
    },

    onRemovePrivilege: function (oEvent) {
      const oModel = this.getView().getModel("newRoleModel");
      const oData = oModel.getData();

      const oItem = oEvent.getSource().getParent();
      const oContext = oItem.getBindingContext("newRoleModel");
      const iIndex = oContext.getPath().split("/").pop();

      oData.PRIVILEGES.splice(iIndex, 1);
      oModel.setData(oData);
    },

    loadCatalog: async function (labelId, modelName) {
      try {
        const response = await fetch(`http://localhost:4004/api/sec/catalogsR?procedure=get&type=bylabelid&&labelid=${labelId}`);
        const data = await response.json();
        const values = data.value?.[0]?.VALUES || [];
        this.getView().setModel(new JSONModel({ values }), modelName);
      } catch (err) {
        Log.error(`Error al cargar catálogo ${labelId}`, err);
      }
    },

    onRoleSelected: function () {
      const oTable = this.byId("rolesTable");
      const iIndex = oTable.getSelectedIndex();

      if (iIndex === -1) {
        MessageToast.show("Selecciona un rol válido.");
        return;
      }

      const oContext = oTable.getContextByIndex(iIndex);
      if (!oContext) {
        MessageBox.error("No se pudo obtener el contexto del rol seleccionado.");
        return;
      }

      const oSelectedRole = oContext.getObject();
      const oSelectedRoleModel = new JSONModel(oSelectedRole);
      this.getOwnerComponent().setModel(oSelectedRoleModel, "selectedRole");

      this.getOwnerComponent().getRouter().navTo("RouteRolesDetail", {
        roleId: encodeURIComponent(oSelectedRole.ROLEID)
      });
    },

    onMultiSearch: function () {
      const sQuery = this.byId("searchRoleName").getValue().toLowerCase();
      const oBinding = this.byId("rolesTable").getBinding("rows");
      const aFilters = sQuery ? [new Filter("ROLENAME", FilterOperator.Contains, sQuery)] : [];
      oBinding.filter(aFilters);
    }
  });
});