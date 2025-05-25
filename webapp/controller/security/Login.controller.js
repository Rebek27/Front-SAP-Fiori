sap.ui.define([
    "com/invertions/sapfiorimodinv/controller/BaseController", 
    "sap/ui/model/json/JSONModel", 
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, BusyIndicator, MessageToast) {
    "use strict";

    return BaseController.extend("com.invertions.sapfiorimodinv.controller.security.BaseController", {
        //Inicializador de la clase LOGIN
        onInit: function () {
           var oModel = new sap.ui.model.json.JSONModel({
            username: "",
            password: ""
        });
        this.getView().setModel(oModel);
        },

        _onRouteMatched: function () {
            BusyIndicator.show(0);
        },

        //Funcion al precionar el boton de iniciar sesion
        onLoginPress: function () {
            //Obtener los datos de los campos de username y email
            var oModel = this.getView().getModel();
            var sUsername = oModel.getProperty("/email");
            var sPassword = oModel.getProperty("/password");
            
            //Verificar que no esten vacios
            if (sUsername && sPassword) {
                // Mostrar indicador de carga
                BusyIndicator.show(0);
                 
                    //Colocar aqui el fetch con que verificara el ususario y contraseña
               
                    
                    var username = "correo1@example.com";
                    var password = "123456";

                    //validar el usuario y el correo
                    if (username !== sUsername || password !== sPassword) {
                        MessageToast.show("Usuario o correo incorrecto");
                        return;
                    }
                    //Mensaje de inicio de sesion correcto
                    MessageToast.show("Inicio de sesión exitoso");
                    this.getRouter().navTo("RouteMain"); // Redirigir a otra vista
               
            } else {
                MessageToast.show("Por favor, ingrese usuario y contraseña");
            }
        },
        onVerContraseña: function () {
            var oPasswordInput = this.byId("passwordInput");
            var oButton = this.byId("showPasswordButton");
            var bIsPassword = oPasswordInput.getType() === "Password";
            oPasswordInput.setType(bIsPassword ? "Text" : "Password");
            oButton.setIcon(bIsPassword ? "sap-icon://hide" : "sap-icon://show");
        },

    });
});
