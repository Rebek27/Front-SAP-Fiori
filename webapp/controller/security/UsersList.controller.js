/* eslint-disable valid-jsdoc */
/* eslint-disable linebreak-style */
/* eslint-disable no-console */
/* eslint-disable fiori-custom/sap-no-hardcoded-url */
/* eslint-disable fiori-custom/sap-no-localhost */
sap.ui.define([
    "com/invertions/sapfiorimodinv/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/base/Log",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function(BaseController,JSONModel,Log,Fragment,MessageToast,MessageBox){
    "use strict";

    return BaseController.extend("com.invertions.sapfiorimodinv.controller.security.UsersList",{
        onInit: function(){

            // Esto desactiva los botones cuando entras a la vista, hasta que selecciones un usuario en la tabla se activan
            var oViewModel = new JSONModel({
                buttonsEnabled: false
            });
            this.getView().setModel(oViewModel, "viewModel");
            //

            // Carga los usuarios
            this.loadUsers();
        },

        /**
         * Funcion para cargar la lista de usuarios.
         */
        loadUsers: function () {
            var oTable = this.byId("IdTable1UsersManageTable");
            var oModel = new JSONModel();
            var that = this;

            fetch("http://localhost:4004/api/security/crudUsers?action=get", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
            })
            .then(res => res.json())
            .then(data => {
                data.value.forEach(user => {
                    user.FORMAT_ROLES = that.formatRoles(user.ROLES);
                });
                console.log(data);
                oModel.setData(data);
                oTable.setModel(oModel);
            })
            .catch(err => {
                if(err.message === ("Cannot read properties of undefined (reading 'setModel')")){
                    return;
                }else{
                    MessageToast.show("Error al cargar usuarios: " + err.message);
                }      
            });       
        },

        loadCompanies: function() {
            var oView = this.getView();
            var oCompaniesModel = new JSONModel();

            fetch("http://localhost:4004/api/security/crudValues?action=get&labelid=IdCompanies", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })
            .then(res => res.json())
            .then(data => {
                oCompaniesModel.setData({ companies: data.value });
                oView.setModel(oCompaniesModel, "companiesModel"); // Usa un modelo nombrado
            })
            .catch(err => MessageToast.show("Error al cargar compañías: " + err.message));
        },

        onCompanySelected: function(oEvent) {
            var oComboBox = oEvent.getSource();
            var sSelectedKey = oComboBox.getSelectedKey();

            this.loadDeptos(sSelectedKey);
        },

        loadDeptos: function(companyId){
            var oView = this.getView();
            var oDeptosModel = new JSONModel();

            fetch("http://localhost:4004/api/security/crudValues?action=get&labelid=IdDepartments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })
            .then(res => res.json())
            .then(data => {
                // Filtramos los departamentos que correspondan a la empresa seleccionada
                var filtered = data.value.filter(function(depto) {
                    return depto.VALUEPAID === `IdCompanies-${companyId}`;
                });
                oDeptosModel.setData({ cedis: filtered });
                oView.setModel(oDeptosModel, "deptosModel");
            })
            .catch(err => MessageToast.show("Error al cargar departamentos: " + err.message));
        },


        /**
         * Funcion para cargar la lista de roles y poderlos visualizar en el combobox
         * Esto va cambiar ya que quiere que primero carguemos las compañías, luego que carguemos los deptos
         * Y en base a las compañías y depto que coloquemos, se muestren los roles que pertenecen a esta compañía y depto.
         */
        loadRoles: function () {
            var oView = this.getView();
            var oRolesModel = new JSONModel();
            fetch("http://localhost:4004/api/security/crudRoles?action=get", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })
            .then(res => res.json())
            .then(data => {
                oRolesModel.setData({ roles: data.value });
                oView.setModel(oRolesModel);
            })
            .catch(err => MessageToast.show("Error al cargar roles: " + err.message));        
        },


        /**
         * Esto es para formatear los roles al cargarlos de la bd y que aparezcan separados por un guion medio en la tabla.
         * Ejemplo: Usuario auxiliar-Investor-etc...
         */
        formatRoles: function (rolesArray) {
            return Array.isArray(rolesArray) 
                ? rolesArray.map(role => role.ROLENAME).join("-") 
                : "";
        },

        editFormatRoles: function (rolesArray) {
            if (!Array.isArray(rolesArray) || rolesArray.length === 0) {
                return "";
            }
            // Modelo de roles
            var oRolesModel = this.getView().getModel();
            if (!oRolesModel) {
                this.loadRoles();
                oRolesModel = this.getView().getModel();
            }
            var aRoles = oRolesModel.getProperty("/roles");
            // Mapea los ROLEID a ROLENAME
            return rolesArray.map(function(roleObj) {
                var found = aRoles.find(function(r) { return r.ROLEID === roleObj.ROLEID; });
                return found ? found.ROLENAME : roleObj.ROLEID;
            }).join("-");
        },

        /**
         * Este evento se encarga de crear los items en el VBox con el nombre de los roles que se vayan agregando.
         */
        onRoleSelected: function (oEvent) {
            var oComboBox = oEvent.getSource();
            var sSelectedKey = oComboBox.getSelectedKey();
            var sSelectedText = oComboBox.getSelectedItem().getText();

            var oVBox;
            // Este if valida si es la modal de add user o edit user en la que se estáran colocando los roles
            if (oComboBox.getId().includes("editcomboBoxRoles")) {
                oVBox = this.getView().byId("editselectedRolesVBox");  // Update User VBox
            } else {
                oVBox = this.getView().byId("selectedRolesVBox");   // Create User VBox
            }
            // Validar duplicados
            var bExists = oVBox.getItems().some(oItem => oItem.data("roleId") === sSelectedKey);
            if (bExists) {
                MessageToast.show("El rol ya ha sido añadido.");
                return;
            }

            // Crear item visual del rol seleccionado
            var oHBox = new sap.m.HBox({
                items: [
                    new sap.m.Label({ text: sSelectedText }).addStyleClass("sapUiSmallMarginEnd"),
                    // @ts-ignore
                    new sap.m.Button({
                        icon: "sap-icon://decline",
                        type: "Transparent",
                        press: () => oVBox.removeItem(oHBox)
                    })
                ]
            });

            oHBox.data("roleId", sSelectedKey);
            oVBox.addItem(oHBox);
        },

        //===================================================
        //=============== AÑADIR USUARIO ====================
        //===================================================

        /**
         * Función onpress del botón para agregar un nuevo usuario
         */
        onAddUser : function() {
        var oView = this.getView();

        // Modelo para el nuevo usuario
        var oNewUserModel = new sap.ui.model.json.JSONModel({
            USERID: "",
            PASSWORD: "",
            ALIAS: "",
            FIRSTNAME: "",
            LASTNAME: "",
            BALANCE: "",
            BIRTHDAYDATE: null,
            EMPLOYEEID: "",
            EMAIL: "",
            PHONENUMBER: "",
            EXTENSION: "",
            AVATAR: "",
            DEPARTMENT: "",
            FUNCTION: "",
            STREET: "",
            POSTALCODE: "",
            CITY: "",
            REGION: "",
            STATE: "",
            COUNTRY: ""
        });
        oView.setModel(oNewUserModel, "newUserModel");

        if (!this._oCreateUserDialog) {
            Fragment.load({
                id: oView.getId(),
                name: "com.invertions.sapfiorimodinv.view.security.fragments.AddUserDialog",
                controller: this
            }).then(oDialog => {
                this._oCreateUserDialog = oDialog;
                oView.addDependent(oDialog);
                this.loadRoles();
                this.loadCompanies();
                this._oCreateUserDialog.open();
            });
        } else {
            this._oCreateUserDialog.open();
        }
    },

        onSaveUser: function() {
            var oView = this.getView();
            var oNewUserModel = oView.getModel("newUserModel");
            var oData = oNewUserModel.getData();

            // Obtener la compañía seleccionada
            /** @type {sap.m.ComboBox} */
            var oComboBox = /** @type {sap.m.ComboBox} */ (sap.ui.core.Fragment.byId(oView.getId(), "comboBoxCompanies"));
            var VID = oComboBox.getProperty("selectedKey");
            var oCompaniesModel = oView.getModel("companiesModel");
            var aCompanies = oCompaniesModel.getProperty("/companies");
            var oSelectedCompany = aCompanies.find(function(company) {
                return company.VALUEID == VID;
            });

            // Extraer los valores de la compañía seleccionada
            var COMPANYID = oSelectedCompany ? oSelectedCompany.VALUEID : "";
            var COMPANYNAME = oSelectedCompany ? oSelectedCompany.VALUE : "";
            var COMPANYALIAS = oSelectedCompany ? oSelectedCompany.ALIAS : "";

            // Obtener el departamento seleccionado
            /** @type {sap.m.ComboBox} */
            var oComboBoxDepto = /** @type {sap.m.ComboBox} */ (sap.ui.core.Fragment.byId(oView.getId(), "comboBoxCedis"));
            var DEPTOID = oComboBoxDepto.getProperty("selectedKey");
            var oDeptosModel = oView.getModel("deptosModel");
            var aDeptos = oDeptosModel.getProperty("/cedis");
            var oSelectedDepto = aDeptos.find(function(depto) {
                return depto.VALUEID == DEPTOID;
            });
            // Extraer los valores del departamento seleccionado
            var DEPARTMENT = oSelectedDepto ? oSelectedDepto.VALUE : "";
            var CEDIID = oSelectedDepto ? oSelectedDepto.VALUEID : "";

            // Obtener roles seleccionados
            /** @type {sap.m.VBox} */
            var oVBox = /** @type {sap.m.VBox} */ (sap.ui.core.Fragment.byId(oView.getId(), "selectedRolesVBox"));
            var ROLES = oVBox.getItems().map(function(oItem) {
                return { ROLEID: oItem.data("roleId") };
            });

            /** @type {sap.m.DatePicker} */
            var oDatePicker = /** @type {sap.m.DatePicker} */ (sap.ui.core.Fragment.byId(oView.getId(), "inputUserBirthdayDate"));
            var oDate = oDatePicker.getDateValue(); // Esto sí es un objeto Date o null

            var sBirthday = "";
            if (oDate) {
                var day = String(oDate.getDate()).padStart(2, '0');
                var month = String(oDate.getMonth() + 1).padStart(2, '0');
                var year = oDate.getFullYear();
                sBirthday = `${day}.${month}.${year}`;
            }

            // Construye el objeto usuario
            var oUser = {
                USERID: oData.USERID,
                USERNAME: oData.FIRSTNAME + " " + oData.LASTNAME,
                PASSWORD: oData.PASSWORD,
                ALIAS: oData.ALIAS,
                FIRSTNAME: oData.FIRSTNAME,
                LASTNAME: oData.LASTNAME,
                EMPLOYEEID: oData.EMPLOYEEID,
                EXTENSION: oData.EXTENSION,
                PHONENUMBER: oData.PHONENUMBER,
                EMAIL: oData.EMAIL,
                BIRTHDAYDATE: sBirthday,
                AVATAR: oData.AVATAR,
                COMPANYID,
                COMPANYNAME,
                COMPANYALIAS,
                CEDIID,
                DEPARTMENT,
                FUNCTION: oData.FUNCTION,
                BALANCE: parseFloat(oData.BALANCE) || 0,
                STREET: oData.STREET,
                POSTALCODE: parseInt(oData.POSTALCODE, 10),
                CITY: oData.CITY,
                REGION: oData.REGION,
                STATE: oData.STATE,
                COUNTRY: oData.COUNTRY,
                ROLES
            };

            console.log(JSON.stringify(oUser));

            // Llama a la API para guardar el usuario
            fetch("http://localhost:4004/api/security/crudUsers?action=create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({users : oUser})
            })
            .then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error("Error al guardar usuario: " + errorText);
                }
                return response.json();
            })
            .then(data => {
                MessageToast.show("Usuario guardado correctamente");
                this._oCreateUserDialog.close();
                this.loadUsers();
            })
            .catch(error => {
                MessageBox.error("No se pudo guardar el usuario:\n" + error.message);
            });
        },

        onCancelUser: function(){
            if (this._oCreateUserDialog) {
                this._oCreateUserDialog.close();
            }
        },

        //===================================================
        //=============== EDITAR USUARIO ====================
        //===================================================

        /**
         * Función onpress del botón para editar un nuevo usuario
         * Agregar la lógica para cargar la info a la modal
         */
        onEditUser: function() {
            var oView = this.getView();

            if (!this.selectedUser) {
                MessageToast.show("Selecciona un usuario para editar");
                return;
            }

            var oEditUserModel = new sap.ui.model.json.JSONModel(Object.assign({}, this.selectedUser));
            oView.setModel(oEditUserModel, "editUserModel");

            // Cargar roles, compañías y departamentos
            var that = this;
            this.loadRoles();
            this.loadCompanies();
            this.loadDeptos(this.selectedUser.COMPANYID);

            if (!this._oEditUserDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.invertions.sapfiorimodinv.view.security.fragments.EditUserDialog",
                    controller: this
                }).then(oDialog => {
                    this._oEditUserDialog = oDialog;
                    oView.addDependent(oDialog);
                    this._oEditUserDialog.open();
                    this._fillEditRolesVBox();
                });
            } else {
                this._oEditUserDialog.open();
                // Selecciona la compañía si el ComboBox ya existe
                var oCombo = /** @type {sap.m.ComboBox} */ (sap.ui.core.Fragment.byId(oView.getId(), "comboBoxCompanies"));
                if (oCombo && this.selectedUser.COMPANYID) {
                    oCombo.setSelectedKey(this.selectedUser.COMPANYID);
                }

                this._fillEditRolesVBox();
            }
        },

        /**
         * Llena el VBox de roles seleccionados en la edición
         */
        _fillEditRolesVBox: function() {
            var oView = this.getView();
            var oVBox = oView.byId("editselectedRolesVBox");
            if (!oVBox) return;
            oVBox.removeAllItems();
            // Obtener los roles
            var oRolesModel = oView.getModel();
            var aRolesCatalog = oRolesModel ? oRolesModel.getProperty("/roles") : [];

            var aRoles = (this.selectedUser && this.selectedUser.ROLES) ? this.selectedUser.ROLES : [];
            aRoles.forEach(function(role) {
                // Busca el nombre del rol usando el ROLEID
                var found = aRolesCatalog.find(function(r) { return r.ROLEID === role.ROLEID; });
                var roleName = found ? found.ROLENAME : role.ROLEID;

                var oHBox = new sap.m.HBox({
                    items: [
                        new sap.m.Label({ text: roleName }).addStyleClass("sapUiSmallMarginEnd"),
                        new sap.m.Button({
                            icon: "sap-icon://decline",
                            type: sap.m.ButtonType.Transparent,
                            press: function() { oVBox.removeItem(oHBox); }
                        })
                    ]
                });
                oHBox.data("roleId", role.ROLEID);
                oVBox.addItem(oHBox);
            });
        },

        onEditSaveUser: function() {
            var oView = this.getView();
            var oEditUserModel = oView.getModel("editUserModel");
            var oData = oEditUserModel.getData();

            // Obtener la compañía seleccionada
            var oComboBox = /** @type {sap.m.ComboBox} */ 
            (sap.ui.core.Fragment.byId(oView.getId(), "editComboBoxCompanies"));
            var VID = oComboBox.getSelectedKey();
            var oCompaniesModel = oView.getModel("companiesModel");
            var aCompanies = oCompaniesModel.getProperty("/companies");
            var oSelectedCompany = aCompanies.find(function(company) {
                return company.VALUEID == VID;
            });

            // Extraer los valores de la compañía seleccionada
            var COMPANYID = oSelectedCompany ? oSelectedCompany.VALUEID : "";
            var COMPANYNAME = oSelectedCompany ? oSelectedCompany.VALUE : "";
            var COMPANYALIAS = oSelectedCompany ? oSelectedCompany.ALIAS : "";

            // Obtener el departamento seleccionado
            /** @type {sap.m.ComboBox} */
            var oComboBoxDepto = /** @type {sap.m.ComboBox} */ 
            (sap.ui.core.Fragment.byId(oView.getId(), "editcomboBoxCedis"));
            var DEPTOID = oComboBoxDepto.getSelectedKey();
            var oDeptosModel = oView.getModel("deptosModel");
            var aDeptos = oDeptosModel.getProperty("/cedis");
            var oSelectedDepto = aDeptos.find(function(depto) {
                return depto.VALUEID == DEPTOID;
            });
            var DEPARTMENT = oSelectedDepto ? oSelectedDepto.VALUE : "";
            var CEDIID = oSelectedDepto ? oSelectedDepto.VALUEID : "";

            // Obtener roles seleccionados
            var oVBox = oView.byId("editselectedRolesVBox");
            var ROLES = oVBox.getItems().map(function(oItem) {
                return { ROLEID: oItem.data("roleId") };
            });

            // Obtener y formatear la fecha de nacimiento
            var sBirthday = "";
            /** @type {sap.m.DatePicker} */
            var oDatePicker = /** @type {sap.m.DatePicker} */ (sap.ui.core.Fragment.byId(oView.getId(), "editUserBirthdayDate"));
            var oDate = oDatePicker.getDateValue();

            // Si el usuario no interactuó con el DatePicker, intenta convertir el valor del modelo
            if (!oDate && oData.BIRTHDAYDATE) {
                sBirthday = oData.BIRTHDAYDATE;
            }



            if (oDate) {
                var day = String(oDate.getDate()).padStart(2, '0');
                var month = String(oDate.getMonth() + 1).padStart(2, '0');
                var year = oDate.getFullYear();
                sBirthday = `${day}.${month}.${year}`;
            }

            // Construye el objeto usuario actualizado
            var oUser = {
                USERID: oData.USERID,
                USERNAME: oData.FIRSTNAME + " " + oData.LASTNAME,
                PASSWORD: oData.PASSWORD,
                ALIAS: oData.ALIAS,
                FIRSTNAME: oData.FIRSTNAME,
                LASTNAME: oData.LASTNAME,
                EMPLOYEEID: oData.EMPLOYEEID,
                EXTENSION: oData.EXTENSION,
                PHONENUMBER: oData.PHONENUMBER,
                EMAIL: oData.EMAIL,
                BIRTHDAYDATE: sBirthday,
                AVATAR: oData.AVATAR,
                COMPANYID,
                COMPANYNAME,
                COMPANYALIAS,
                CEDIID,
                DEPARTMENT,
                FUNCTION: oData.FUNCTION,
                BALANCE: parseFloat(oData.BALANCE) || 0,
                STREET: oData.STREET,
                POSTALCODE: parseInt(oData.POSTALCODE, 10),
                CITY: oData.CITY,
                REGION: oData.REGION,
                STATE: oData.STATE,
                COUNTRY: oData.COUNTRY,
                ROLES
            };
            console.log("Usuario a actualizar:", JSON.stringify(oUser));

            // Llama a la API para actualizar el usuario
            fetch(`http://localhost:4004/api/security/crudUsers?action=update&userid=${encodeURIComponent(this.selectedUser.USERID)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ users: oUser })
            })
            .then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error("Error al actualizar usuario: " + errorText);
                }
                return response.json();
            })
            .then(data => {
                MessageToast.show("Usuario actualizado correctamente");
                // Actualiza el modelo local de la tabla
                var oTable = this.byId("IdTable1UsersManageTable");
                var oModel = oTable.getModel();
                var oTableData = oModel.getData();

                this._originalUserId = this.selectedUser.USERID;
                var idx = oTableData.value.findIndex(u => u.USERID === this._originalUserId);
                if (idx !== -1) {
                    oTableData.value[idx] = oUser;
                    oTableData.value[idx].FORMAT_ROLES = this.editFormatRoles(oUser.ROLES);
                    
                    oModel.setData(oTableData);
                }
                this._originalUserId = null;
                // Actualizar this.selectedUser para que apunte al objeto actualizado
                this.selectedUser = oTableData.value[idx];
                this._oEditUserDialog.close();
            })
            .catch(error => {
                MessageBox.error("No se pudo actualizar el usuario:\n" + error.message);
            });
        },

        onEditCancelUser: function(){
            if (this._oEditUserDialog) {
                var oView = this.getView();
                // Limpia el modelo editUserModel
                var oEditUserModel = oView.getModel("editUserModel");
                if (oEditUserModel) {
                    oEditUserModel.setData({
                        USERID: "",
                        PASSWORD: "",
                        USERNAME: "",
                        ALIAS: "",
                        FIRSTNAME: "",
                        LASTNAME: "",
                        BALANCE: "",
                        BIRTHDAYDATE: null,
                        EMPLOYEEID: "",
                        EMAIL: "",
                        PHONENUMBER: "",
                        EXTENSION: "",
                        AVATAR: "",
                        DEPARTMENT: "",
                        FUNCTION: "",
                        STREET: "",
                        POSTALCODE: "",
                        CITY: "",
                        REGION: "",
                        STATE: "",
                        COUNTRY: "",
                        COMPANYID: "",
                        CEDIID: "",
                        ROLES: []
                    });
                }

                this._oEditUserDialog.close();
            }
        },


        // ===================================================
        // ========= Eliminar Usuario Fisicamente ============
        // ===================================================

        /**
         * Función onDeleteUser .
         */
        onDeleteUser: function(){
            if (this.selectedUser) {
                var that = this;
                MessageBox.confirm("¿Deseas eliminar el usuario con nombre: " + this.selectedUser.USERNAME + "?", {
                    title: "Confirmar eliminación",
                    icon: MessageBox.Icon.WARNING,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that.deleteUser(that.selectedUser.USERID);
                        }
                    }
                });
            }else{
                MessageToast.show("Selecciona un usuario para eliminar de la base de datos");
            }
        },

        deleteUser: function(UserId){
            var that = this;
            fetch(`http://localhost:4004/api/security/deleteAny?borrado=fisic&userid=${encodeURIComponent(UserId)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })
            .then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error("Error al eliminar usuario: " + errorText);
                }
                return response.json();
            })
            .then(data => {
                MessageToast.show("Usuario eliminado correctamente");
                // Elimina el usuario del array y actualiza el modelo
                var oTable = that.byId("IdTable1UsersManageTable");
                var oModel = oTable.getModel();
                var oData = oModel.getData();
                oData.value = oData.value.filter(u => u.USERID !== UserId);
                oModel.setData(oData);
            })
            .catch(error => {
                MessageBox.error("No se pudo eliminar el usuario:\n" + error.message);
            });
        },

        // ===================================================
        // ============ Desactivar el usuario ================
        // ===================================================

        /**
         * Función onDesactivateUser.
         */
        onDesactivateUser: function(){
            if (this.selectedUser) {
                var that = this;
                MessageBox.confirm("¿Deseas desactivar el usuario con nombre: " + this.selectedUser.USERNAME + "?", {
                    title: "Confirmar desactivación",
                    icon: MessageBox.Icon.WARNING,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that.desactivateUser(that.selectedUser.USERID);
                        }
                    }
                });
            }else{
                MessageToast.show("Selecciona un usuario para desactivar");
            }
        },

        desactivateUser: function(UserId){
            var that = this;
            fetch(`http://localhost:4004/api/security/deleteAny?borrado=logic&userid=${encodeURIComponent(UserId)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })
            .then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error("Error al desactivar usuario: " + errorText);
                }
                return response.json();
            })
            .then(data => {
                MessageToast.show("Usuario desactivado correctamente");
                // Se actualiza el modelo localmente sin volver a llamar a la API
                var oTable = that.byId("IdTable1UsersManageTable");
                var oModel = oTable.getModel();
                var oData = oModel.getData();
                var user = oData.value.find(u => u.USERID === UserId);
                if (user) {
                    user.DETAIL_ROW.ACTIVED = false;
                    user.DETAIL_ROW.DELETED = true;
                }
                oModel.setData(oData);
            })
            .catch(error => {
                MessageBox.error("No se pudo desactivar el usuario:\n" + error.message);
            });
        },


        // ===================================================
        // ============== Activar el usuario =================
        // ===================================================

        /**
         * Función onActivateUser.
         */
        onActivateUser: function(){
            if (this.selectedUser) {
                var that = this;
                MessageBox.confirm("¿Deseas activar el usuario con nombre: " + this.selectedUser.USERNAME + "?", {
                    title: "Confirmar activación",
                    icon: MessageBox.Icon.WARNING,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that.activateUser(that.selectedUser.USERID);
                        }
                    }
                });
            }else{
                MessageToast.show("Selecciona un usuario para activar");
            }
        },

        activateUser: function(UserId){
            var that = this;
            fetch(`http://localhost:4004/api/security/deleteAny?borrado=activar&userid=${encodeURIComponent(UserId)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })
            .then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error("Error al activar usuario: " + errorText);
                }
                return response.json();
            })
            .then(data => {
                MessageToast.show("Usuario activado correctamente");
                // Se actualiza el modelo localmente sin volver a llamar a la API
                var oTable = that.byId("IdTable1UsersManageTable");
                var oModel = oTable.getModel();
                var oData = oModel.getData();
                var user = oData.value.find(u => u.USERID === UserId);
                if (user) {
                    user.DETAIL_ROW.ACTIVED = true;
                    user.DETAIL_ROW.DELETED = false;
                }
                oModel.setData(oData);
            })
            .catch(error => {
                MessageBox.error("No se pudo activar el usuario:\n" + error.message);
            });
        },


        //===================================================
        //=============== Funciones de la tabla =============
        //===================================================

        /**
         * Función que obtiene el usuario que se selecciona en la tabla en this.selectedUser se guarda todo el usuario
         * Además activa los botones de editar/eliminar/desactivar y activar
         */
        onUserRowSelected: function () {
            var oTable = this.byId("IdTable1UsersManageTable");
            var iSelectedIndex = oTable.getSelectedIndex();

            if (iSelectedIndex < 0) {
                this.getView().getModel("viewModel").setProperty("/buttonsEnabled", false);
                return;
            }

            var oContext = oTable.getContextByIndex(iSelectedIndex);
            var UserData = oContext.getObject();

            this.selectedUser = UserData;

            // Activa los botones
            this.getView().getModel("viewModel").setProperty("/buttonsEnabled", true);
        },

        onSearchUser: function () {
            //Aplicar el filtro de búsqueda para la tabla
        },

        onRefresh: function(){
            this.loadUsers();
        },


        //===================================================
        //=========== Validar email y phonenumber ===========
        //===================================================

        isValidEmail: function(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },

        isValidPhoneNumber: function(phone) {
            return /^\d{10}$/.test(phone); // Ejemplo: 10 dígitos numéricos
        }


    });
});