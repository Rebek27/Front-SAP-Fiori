sap.ui.define(
  [
    "com/invertions/sapfiorimodinv/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/base/Log",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
  ],
  function (
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

    return BaseController.extend(
      "com.invertions.sapfiorimodinv.controller.security.RolesMaster",
      {
        _pDialog: null,
        _pEditDialog: null,
        _catalogsLoaded: false,

        onInit: function () {
          this.initModels();
          const oRouter = this.getRouter();
          oRouter
            .getRoute("RouteRolesMaster")
            .attachPatternMatched(this._onRouteMatched, this);
          this._loadFragments();
        },

        _loadFragments: function () {
          this._pDialog = Fragment.load({
            name: "com/invertions/sapfiorimodinv/view/security/fragments/AddRoleDialog",
            controller: this,
          }).then((oDialog) => {
            this.getView().addDependent(oDialog);
            return oDialog;
          });

          this._pEditDialog = Fragment.load({
            name: "com/invertions/sapfiorimodinv/view/security/fragments/EditRoleDialog",
            controller: this,
          }).then((oDialog) => {
            this.getView().addDependent(oDialog);
            return oDialog;
          });
        },

        _onRouteMatched: function () {
          this.loadRolesData();
        },

        initModels: function () {
          const oView = this.getView();
          oView.setModel(new JSONModel(), "selectedRole");
          const emptyRoleData = {
            ROLEID: "",
            ROLENAME: "",
            DESCRIPTION: "",
            NEW_PROCESSID: "",
            NEW_PRIVILEGES: [],
            PRIVILEGES: [],
          };
          oView.setModel(
            new JSONModel(Object.assign({}, emptyRoleData)),
            "newRoleModel"
          );
          oView.setModel(
            new JSONModel(Object.assign({}, emptyRoleData)),
            "roleDialogModel"
          );
        },

        loadCatalogsOnce: async function () {
          if (!this._catalogsLoaded) {
            await this._loadCatalog("IdProcesses", "processCatalogModel");
            await this._loadCatalog("IdPrivileges", "privilegeCatalogModel");
            this._catalogsLoaded = true;
          }
        },

        _loadCatalog: async function (labelId, modelName) {
          const view = this.getView();
          try {
            const response = await fetch(
              "http://localhost:4004/api/security/crudValues?action=get",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              }
            );
            if (!response.ok) {
              const errorText = await response.text();
              Log.error(
                `Error fetching catalog (${labelId}): ${response.status} - ${errorText}`
              );
              MessageBox.error(
                `Error al cargar el catálogo (${labelId}). Por favor, inténtelo de nuevo.`
              );
              return;
            }
            const data = await response.json();
            const filteredValues = data.value.filter(
              (v) => v.LABELID === labelId
            );
            view.setModel(new JSONModel({ values: filteredValues }), modelName);
            Log.info(
              `Catálogo '${labelId}' cargado en el modelo '${modelName}'.`
            );
          } catch (error) {
            Log.error(`Error al cargar el catálogo (${labelId}): ${error}`);
            MessageBox.error(
              `Error al cargar el catálogo (${labelId}). Por favor, revise la consola.`
            );
          }
        },

        onOpenDialog: async function () {
          await this.loadCatalogsOnce(); 
          const oDialog = await this._pDialog;
          this.getView().getModel("newRoleModel").setData({
            ROLEID: "",
            ROLENAME: "",
            DESCRIPTION: "",
            NEW_PROCESSID: "",
            NEW_PRIVILEGES: [],
            PRIVILEGES: [],
          });
          oDialog.setTitle("Crear Rol");
          oDialog.open();
        },

        onOpenEditDialog: async function (oSelectedRoleData) {
          await this.loadCatalogsOnce(); 
          const oDialog = await this._pEditDialog;
          const oEditModel = this.getView().getModel("roleDialogModel");
          oEditModel.setData({
            ROLEID: oSelectedRoleData.ROLEID || "",
            ROLENAME: oSelectedRoleData.ROLENAME || "",
            DESCRIPTION: oSelectedRoleData.DESCRIPTION || "",
            NEW_PROCESSID: "",
            NEW_PRIVILEGES: [],
            PRIVILEGES: oSelectedRoleData.PRIVILEGES || [],
          });
          oDialog.setTitle("Editar Rol");
          oDialog.open();
          Log.info(
            `Diálogo de edición abierto para el rol: ${oSelectedRoleData.ROLEID}`
          );
        },

        onDialogClose: function () {
          if (this._pDialog) {
            this._pDialog.then((oDialog) => oDialog.close());
          }
          if (this._pEditDialog) {
            this._pEditDialog.then((oDialog) => oDialog.close());
          }
        },

        onAddPrivilege: function () {
          const oModel = this.getView().getModel("roleDialogModel"); 
          const oData = oModel.getData();
          if (
            !oData.NEW_PROCESSID ||
            !Array.isArray(oData.NEW_PRIVILEGES) ||
            oData.NEW_PRIVILEGES.length === 0
          ) {
            MessageToast.show("Selecciona proceso y al menos un privilegio.");
            return;
          }
          oData.PRIVILEGES.push({
            PROCESSID: oData.NEW_PROCESSID,
            PRIVILEGEID: oData.NEW_PRIVILEGES,
          });
          oData.NEW_PROCESSID = "";
          oData.NEW_PRIVILEGES = [];
          oModel.setData(oData);
        },

        onSaveRole: function () {
          // Esta función ahora solo cierra el diálogo.
          this.onDialogClose();
        },

        onConfirmRoleSave: async function () {
          const oSelectedRole = this.getView()
            .getModel("selectedRole")
            .getData();
          if (oSelectedRole && oSelectedRole.ROLEID) {
            // Lógica para actualizar un rol existente
            const oEditData = this.getView()
              .getModel("roleDialogModel")
              .getData();
            const oUpdatePayload = {
              roles: {
                ROLEID: oSelectedRole.ROLEID,
                ROLENAME: oEditData.ROLENAME,
                DESCRIPTION: oEditData.DESCRIPTION,
                PRIVILEGES: oEditData.PRIVILEGES,
              },
            };
            await this._saveRoleData("update", oUpdatePayload);
          } else {
            // Lógica para crear un nuevo rol
            const oCreateData = this.getView()
              .getModel("newRoleModel")
              .getData();
            await this._saveRoleData("create", { roles: oCreateData });
          }
        },

        _saveRoleData: async function (sAction, oPayload) {
          try {
            const response = await fetch(
              `http://localhost:4004/api/security/crudRoles?action=${sAction}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPayload),
              }
            );
            if (!response.ok) {
              const errorText = await response.text();
              Log.error(
                `Error saving role (${sAction}): ${response.status} - ${errorText}`
              );
              MessageBox.error(`Error al guardar el rol: ${errorText}`);
              return;
            }
            MessageToast.show(`Rol guardado correctamente (${sAction}).`);
            this.loadRolesData(); // Recargar los roles después de guardar
          } catch (error) {
            Log.error(`Error al guardar el rol (${sAction}):`, error);
            MessageBox.error(
              "Error al guardar el rol. Por favor, inténtelo de nuevo."
            );
          }
        },

        loadRolesData: async function () {
          try {
            const response = await fetch(
              "http://localhost:4004/api/security/crudRoles?action=get",
              { method: "POST" }
            );
            if (!response.ok) {
              const errorText = await response.text();
              Log.error(
                `Error fetching roles: ${response.status} - ${errorText}`
              );
              MessageBox.error(`Error al cargar los roles: ${errorText}`);
              return;
            }
            const data = await response.json();
            const aAllRoles = (data.value || []).filter(
              (role) => !role.DETAIL_ROW?.DELETED
            );
            const aFiltered = aAllRoles.filter(
              (role) => role.DETAIL_ROW?.ACTIVED
            );
            const oRolesModel = new JSONModel({
              value: aFiltered,
              valueAll: aAllRoles,
              filterKey: "active",
            });
            this.getOwnerComponent().setModel(oRolesModel, "roles");
            Log.info("Datos de roles cargados.");
          } catch (error) {
            Log.error("Error al cargar roles:", error);
            MessageBox.error(
              "Error al cargar los roles. Por favor, revise la consola."
            );
          }
        },

        onStatusFilterChange: function (oEvent) {
          const sKey = oEvent.getSource().getSelectedKey();
          const oRolesModel = this.getOwnerComponent().getModel("roles");
          const aAllRoles = oRolesModel.getProperty("/valueAll") || [];
          let aFiltered = [];
          switch (sKey) {
            case "active":
              aFiltered = aAllRoles.filter(
                (r) => r.DETAIL_ROW?.ACTIVED && !r.DETAIL_ROW?.DELETED
              );
              break;
            case "inactive":
              aFiltered = aAllRoles.filter(
                (r) => !r.DETAIL_ROW?.ACTIVED && !r.DETAIL_ROW?.DELETED
              );
              break;
            default:
              aFiltered = aAllRoles.filter((r) => !r.DETAIL_ROW?.DELETED);
          }
          oRolesModel.setProperty("/value", aFiltered);
          oRolesModel.setProperty("/filterKey", sKey);
        },

        onRemovePrivilege: function (oEvent) {
          const oModel = this.getView().getModel("roleDialogModel"); // Usar el modelo de edición
          const oData = oModel.getData();
          const oItem = oEvent.getSource().getParent();
          const oContext = oItem.getBindingContext("roleDialogModel");
          const iIndex = oContext.getPath().split("/").pop();
          oData.PRIVILEGES.splice(iIndex, 1);
          oModel.setData(oData);
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
            MessageBox.error(
              "No se pudo obtener el contexto del rol seleccionado."
            );
            return;
          }

          const oSelectedRole = oContext.getObject();
          this.getOwnerComponent()
            .getRouter()
            .navTo("RouteRolesDetail", {
              roleId: encodeURIComponent(oSelectedRole.ROLEID),
            });
        },


        onMultiSearch: function () {
          const sQuery = this.byId("searchRoleName").getValue().toLowerCase();
          const oBinding = this.byId("rolesTable").getBinding("rows");
          const aFilters = sQuery
            ? [new Filter("ROLENAME", FilterOperator.Contains, sQuery)]
            : [];
          oBinding.filter(aFilters);
        },

      }
    );
  }
);
