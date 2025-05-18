sap.ui.define(
  [
    "com/invertions/sapfiorimodinv/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/base/Log",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
  ],
  function (
    BaseController,
    JSONModel,
    Log,
    MessageToast,
    MessageBox,
    Fragment
  ) {
    "use strict";

    return BaseController.extend(
      "com.invertions.sapfiorimodinv.controller.security.RolesDetail",
      {
        _catalogsLoaded: false,

        onInit: function () {
          const oRouter = this.getRouter();
          oRouter
            .getRoute("RouteRolesDetail")
            .attachPatternMatched(this._onRouteMatched, this);

          this.getView().setModel(new JSONModel({}), "selectedRole");
          this.getView().setModel(
            new JSONModel({ values: [] }),
            "processCatalogModel"
          );
          this.getView().setModel(
            new JSONModel({ values: [] }),
            "privilegeCatalogModel"
          );
        },

        _onRouteMatched: async function (oEvent) {
          const sRoleId = decodeURIComponent(
            oEvent.getParameter("arguments").roleId
          );
          this._loadRoleDetails(sRoleId);
          await this._loadCatalogsOnce(); // Cargar los catálogos al activar la ruta
        },

        _loadCatalogsOnce: async function () {
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

        onNavBack: function () {
          const oHistory = sap.ui.core.routing.History.getInstance();
          const sPreviousHash = oHistory.getPreviousHash();

          if (sPreviousHash !== undefined) {
            window.history.go(-1);
          } else {
            this.getOwnerComponent()
              .getRouter()
              .navTo("RouteRolesMaster", {}, true);
          }
        },

        _handleRoleAction: async function (options) {
          const oModel = this.getView().getModel("selectedRole");
          const oData = oModel ? oModel.getData() : null;
          const that = this;

          if (!oData || !oData.ROLEID) {
            MessageToast.show("No se encontró el ROLEID.");
            return;
          }

          MessageBox[options.dialogType](
            options.message.replace("{ROLENAME}", oData.ROLENAME),
            {
              title: options.title,
              actions: options.actions,
              emphasizedAction: options.emphasizedAction,
              onClose: async function (oAction) {
                if (oAction === options.confirmAction) {
                  try {
                    const response = await fetch(
                      `${options.url}${oData.ROLEID}`,
                      {
                        method: options.method,
                      }
                    );

                    const result = await response.json();

                    if (result && !result.error) {
                      MessageToast.show(options.successMessage);
                      const oRolesModel = that
                        .getOwnerComponent()
                        .getModel("roles");
                      if (oRolesModel) {
                        const aRoles = oRolesModel.getProperty("/value");
                        const aUpdatedRoles = aRoles.filter(
                          (role) => role.ROLEID !== oData.ROLEID
                        );
                        oRolesModel.setProperty("/value", aUpdatedRoles);
                      }

                      that
                        .getOwnerComponent()
                        .getRouter()
                        .navTo("RouteRolesMaster");
                    } else {
                      MessageBox.error(
                        "Error: " + (result?.message || "desconocido")
                      );
                    }
                  } catch (error) {
                    MessageBox.error("Error en la petición: " + error.message);
                  }
                }
              },
            }
          );
        },

        onDesactivateRole: function () {
          this._handleRoleAction({
            dialogType: "confirm",
            message:
              '¿Estás seguro de que deseas desactivar el rol "{ROLENAME}"?',
            title: "Confirmar desactivación",
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            emphasizedAction: MessageBox.Action.YES,
            confirmAction: MessageBox.Action.YES,
            method: "POST",
            url: "http://localhost:4004/api/security/deleteAny?roleid=",
            successMessage: "Rol desactivado correctamente.",
          });
        },

        onDeleteRole: function () {
          this._handleRoleAction({
            dialogType: "warning",
            message:
              '¿Estás seguro de que deseas eliminar el rol "{ROLENAME}" permanentemente? Esta acción no se puede deshacer.',
            title: "Confirmar eliminación permanente",
            actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.DELETE,
            confirmAction: MessageBox.Action.DELETE,
            method: "POST",
            url: "http://localhost:4004/api/security/deleteAny?borrado=&roleid=",
            successMessage: "Rol eliminado permanentemente.",
          });
        },

        onUpdateRole: function () {
          const oView = this.getView();
          const oSelectedRole = oView.getModel("selectedRole").getData();

          const oModel = new JSONModel({
            ROLEID: oSelectedRole.ROLEID,
            ROLENAME: oSelectedRole.ROLENAME,
            DESCRIPTION: oSelectedRole.DESCRIPTION,
            PRIVILEGES: oSelectedRole.PROCESSES.map((proc) => ({
              PROCESSID: proc.PROCESSID,
              PRIVILEGEID: proc.PRIVILEGES.map((p) => p.PRIVILEGEID),
            })),
            NEW_PROCESSID: "",
            NEW_PRIVILEGES: [],
            IS_EDIT: true,
          });
          oView.setModel(oModel, "roleDialogModel");

          oView.setModel(
            this.getView().getModel("processCatalogModel"),
            "processCatalogModel"
          );
          oView.setModel(
            this.getView().getModel("privilegeCatalogModel"),
            "privilegeCatalogModel"
          );

          const oExistingDialog = this.byId("dialogEditRole");
          if (oExistingDialog) {
            oExistingDialog.destroy();
          }

          Fragment.load({
            id: oView.getId(),
            name: "com.invertions.sapfiorimodinv.view.security.fragments.EditRoleDialog",
            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);
            oDialog.setTitle("Editar Rol");
            oDialog.open();
          });
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

        onRemovePrivilege: function (oEvent) {
          const oModel = this.getView().getModel("roleDialogModel");
          const oData = oModel.getData();

          const oItem = oEvent.getSource().getParent();
          const oContext = oItem.getBindingContext("roleDialogModel");
          const iIndex = oContext.getPath().split("/").pop();

          oData.PRIVILEGES.splice(iIndex, 1);
          oModel.setData(oData);
        },

        _loadRoleDetails: function (sRoleId) {
          const oModel = this.getOwnerComponent().getModel("roles");
          if (oModel) {
            const aRoles = oModel.getProperty("/value");
            const oRole = aRoles.find((role) => role.ROLEID === sRoleId);
            if (oRole) {
              const oSelectedRoleModel =
                this.getView().getModel("selectedRole");
              oSelectedRoleModel.setData(oRole);
              Log.debug(
                "_loadRoleDetails: Datos iniciales del selectedRole",
                oRole
              ); // Log aquí
            } else {
              MessageToast.show("Rol no encontrado.");
            }
          } else {
            MessageToast.show("Modelo de roles no disponible.");
          }
        },

        onSaveRoleEdit: async function () {
          const oData = this.getView().getModel("roleDialogModel").getData();

          if (!oData.ROLEID || !oData.ROLENAME) {
            MessageToast.show("ID y Nombre del Rol son obligatorios.");
            return;
          }

          try {
            const response = await fetch(
              `http://localhost:4004/api/security/crudRoles?action=update&roleid=${oData.ROLEID}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  roles: {
                    ROLENAME: oData.ROLENAME,
                    DESCRIPTION: oData.DESCRIPTION,
                    PRIVILEGES: oData.PRIVILEGES.map((privilege) => ({
                      PROCESSID: privilege.PROCESSID,
                      PRIVILEGEID: Array.isArray(privilege.PRIVILEGEID)
                        ? privilege.PRIVILEGEID
                        : [privilege.PRIVILEGEID],
                    })),
                  },
                }),
              }
            );

            if (!response.ok) throw new Error(await response.text());

            MessageToast.show("Rol actualizado correctamente.");

            const oRolesModel = this.getOwnerComponent().getModel("roles");
            const aRoles = oRolesModel.getProperty("/value");
            const updatedRole = aRoles.find(
              (role) => role.ROLEID === oData.ROLEID
            ); // Busca el rol *actualizado*

            if (updatedRole) {
              const oSelectedRoleModel =
                this.getView().getModel("selectedRole");
              oSelectedRoleModel.setData(Object.assign({}, updatedRole)); // Establece *todo* el rol actualizado
              this.byId("processesTable").getBinding("rows").refresh(); // Refresca la tabla
            }

            const oDialog = this.byId("dialogEditRole");
            if (oDialog) {
              oDialog.close();
            }
          } catch (err) {
            MessageBox.error("Error al actualizar el rol: " + err.message);
          }
        },
        onDialogClose: function () {
          const oDialog = this.byId("dialogEditRole");
          if (oDialog) {
            oDialog.close();
          }
        },
      }
    );
  }
);
