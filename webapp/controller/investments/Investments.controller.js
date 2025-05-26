sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",             
  "sap/ui/core/format/DateFormat",  
  "sap/m/MessageBox",               
  "sap/viz/ui5/controls/VizFrame",  
  "sap/viz/ui5/data/FlattenedDataset", 
  "sap/viz/ui5/controls/common/feeds/FeedItem" 
], function(Controller, JSONModel, MessageToast, DateFormat, MessageBox, VizFrame, FlattenedDataset, FeedItem) { 
  "use strict";

  return Controller.extend("com.invertions.sapfiorimodinv.controller.investments.Investments", {

      _oResourceBundle: null,
      _bSidebarExpanded: true, 
      _sSidebarOriginalSize: "380px", 

      onInit: function() {
    // 1. Modelo para los símbolos (datos estáticos por ahora)
    this._initSymbolModel();
    
    // 2. Modelo para la tabla (vacío)
    this.getView().setModel(new JSONModel({
        value: [] 
    }), "priceData");

    // 3. Configurar gráfica
    this.getView().addEventDelegate({
        onAfterRendering: this._onViewAfterRendering.bind(this)
    });

    var oViewModel = new sap.ui.model.json.JSONModel({
        selectedTab: "table"
    });
    this.getView().setModel(oViewModel, "viewModel");

    // Inicializar el modelo de análisis
    var oStrategyAnalysisModelData = {
        balance: 1000,
        stock: 1,
        strategyKey: "",
        longSMA: 200,
        shortSMA: 50,
        startDate: null,
        endDate: null,
        controlsVisible: false,
        strategies: [
            { key: "", text: "Cargando textos..." },
            { key: "MACrossover", text: "Cargando textos..." }
        ]
    };
    var oStrategyAnalysisModel = new JSONModel(oStrategyAnalysisModelData);
    this.getView().setModel(oStrategyAnalysisModel, "strategyAnalysisModel");

   this.getView().setModel(new JSONModel({
    strategies: [
        {
            strategyName: "Estrategia MA Crossover",
            symbol: "AAPL",
            result: 2500.50,
            details: {
                STRATEGY: "Media Móvil 50/200",
                STARTDATE: "2024-05-01",
                ENDDATE: "2024-05-15"
            }
        },
        {
            strategyName: "Estrategia RSI",
            symbol: "TSLA",
            result: -1200.30,
            details: {
                STRATEGY: "RSI Sobrevendido",
                STARTDATE: "2024-05-10",
                ENDDATE: "2024-05-16"
            }
        },
        {
            strategyName: "Estrategia Breakout",
            symbol: "MSFT",
            result: 3400.80,
            details: {
                STRATEGY: "Breakout Nivel 100",
                STARTDATE: "2024-05-05",
                ENDDATE: "2024-05-17"
            }
        },
        {
            strategyName: "Estrategia MACD",
            symbol: "NVDA",
            result: 5200.75,
            details: {
                STRATEGY: "MACD Divergencia",
                STARTDATE: "2024-05-12",
                ENDDATE: "2024-05-18"
            }
        },
        {
            strategyName: "Estrategia Bollinger",
            symbol: "AMZN",
            result: -800.20,
            details: {
                STRATEGY: "Bandas Bollinger",
                STARTDATE: "2024-05-08",
                ENDDATE: "2024-05-14"
            }
        }
    ],
    filteredCount: 0,
    selectedCount: 0,
    filters: {
        dateRange: null,
        investmentRange: [0, 10000],
        profitRange: [-100, 100]
    },
    isDeleteMode: false
}), "historyModel");

    //Inicialización modelo de resultados
    var oStrategyResultModel = new JSONModel({
        hasResults: false,
        idSimulation: null,
        signal: null,
        date_from: null,
        date_to: null,
        moving_averages: { short: null, long: null },
        signals: [],
        chart_data: {},
        result: null
    });
    this.getView().setModel(oStrategyResultModel, "strategyResultModel");
    
    this._setDefaultDates();

    // Cargar el ResourceBundle
    var oI18nModel = this.getOwnerComponent().getModel("i18n");
    if (oI18nModel) {
        try {
            var oResourceBundle = oI18nModel.getResourceBundle();
            if (oResourceBundle && typeof oResourceBundle.getText === 'function') {
                this._oResourceBundle = oResourceBundle;
                oStrategyAnalysisModel.setProperty("/strategies", [
                    { key: "", text: this._oResourceBundle.getText("selectStrategyPlaceholder") },
                    { key: "MACrossover", text: this._oResourceBundle.getText("movingAverageCrossoverStrategy") }
                ]);
                console.log("Textos de i18n cargados correctamente.");
            } else {
                throw new Error("ResourceBundle no válido");
            }
        } catch (error) {
            console.error("Error al cargar ResourceBundle:", error);
            oStrategyAnalysisModel.setProperty("/strategies", [
                { key: "", text: "Error i18n: Seleccione..." },
                { key: "MACrossover", text: "Error i18n: Cruce Medias..." }
            ]);
        }
    } else {
        console.error("Modelo i18n no encontrado. Usando textos por defecto.");
        oStrategyAnalysisModel.setProperty("/strategies", [
            { key: "", text: "No i18n: Seleccione..." },
            { key: "MACrossover", text: "No i18n: Cruce Medias..." }
        ]);
    }

    // Para el tamaño del Sidebar
    var oSidebarLayoutData = this.byId("sidebarLayoutData");
    if (oSidebarLayoutData) {
        this._sSidebarOriginalSize = oSidebarLayoutData.getSize();
    } else {
        var oSidebarVBox = this.byId("sidebarVBox");
        if (oSidebarVBox && oSidebarVBox.getLayoutData()) {
            this._sSidebarOriginalSize = oSidebarVBox.getLayoutData().getSize();
        }
    }
},
      onTabSelect: function(oEvent) {
        var sKey = oEvent.getParameter("key");
        this.getView().getModel("viewModel").setProperty("/selectedTab", sKey);
    },

      _onViewAfterRendering: function() {
            this._configureChart();
        },

      _initSymbolModel: function() {
        const oSymbolModel = new JSONModel({
          symbols: [
            { symbol: "TSLA", name: "Tesla" },
            { symbol: "AAPL", name: "Apple" },
            { symbol: "MSFT", name: "Microsoft" }
          ]
        });
        this.getView().setModel(oSymbolModel, "symbolModel");
      },

      /* onSymbolChange: function(oEvent) {
        const sSymbol = oEvent.getSource().getSelectedKey();
        this._loadPriceData(sSymbol).then(aData => {
            const oPriceModel = this.getView().getModel("priceData");
            oPriceModel.setProperty("/originalValue", aData); // Guarda los datos originales
            oPriceModel.setProperty("/value", aData); // Muestra los datos en la gráfica
        }).catch(error => {
            console.error("Error al cargar los datos del símbolo:", error.message);
        });
    }, */
    _transformDataForVizFrame: function(aApiData) {
        if (!aApiData || !Array.isArray(aApiData)) {
            return [];
        }
        return aApiData.map(oItem => {
            let dateValue = oItem.DATE || oItem.date;

            let closeValue = parseFloat(oItem.CLOSE || oItem.close);
            if (isNaN(closeValue)) closeValue = null;

            return {
                DATE: dateValue,
                OPEN: parseFloat(oItem.OPEN) || null,
                HIGH: parseFloat(oItem.HIGH) || null,
                LOW: parseFloat(oItem.LOW) || null,
                CLOSE: closeValue,
                VOLUME: parseFloat(oItem.VOLUME) || null,
            };
        });
    },

    _configureChart: function() {
        const oVizFrame = this.byId("idVizFrame");
        if (!oVizFrame) {
            console.warn("Función _configureChart: VizFrame con ID 'idVizFrame' no encontrado en este punto del ciclo de vida.");
            return;
        }
    
        oVizFrame.setVizProperties({
            plotArea: {
                dataLabel: { visible: false },
                window: {
                    start: null, 
                    end: null   
                }
            },
            valueAxis: {
                title: { text: "Precio de Cierre (USD)" }
            },
            timeAxis: {
                title: { text: "Fecha" },
                levels: ["day", "month", "year"],
                label: {
                    formatString: "dd/MM/yy"
                }
            },
            title: {
                text: "Histórico de Precios de Acciones"
            },
            legend: {
                visible: true
            },
            toolTip: {
                visible: true,
                formatString: "#,##0.00"
            },
            interaction: {
                zoom: {
                    enablement: "enabled"
                },
                selectability: {
                    mode: "single"
                }
            }
        });
        console.log("Propiedades de VizFrame configuradas para permitir zoom.");
    },

      // PANEL DE ESTRATEGIAS
      _setDefaultDates: function () { 
          var oStrategyAnalysisModel = this.getView().getModel("strategyAnalysisModel");
          var oToday = new Date();
          oStrategyAnalysisModel.setProperty("/endDate", new Date(oToday));
          var oStartDate = new Date(oToday);
          oStartDate.setMonth(oStartDate.getMonth() - 6);
          oStrategyAnalysisModel.setProperty("/startDate", new Date(oStartDate));
      },
      
      onStrategyChange: function (oEvent) { 
          var oStrategyAnalysisModel = this.getView().getModel("strategyAnalysisModel");
          var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
          oStrategyAnalysisModel.setProperty("/controlsVisible", !!sSelectedKey);
      },

      onRunAnalysisPress: function() {
    var oView = this.getView();
    var oStrategyModel = oView.getModel("strategyAnalysisModel");
    var oResultModel = oView.getModel("strategyResultModel");
    var oAnalysisPanel = this.byId("strategyAnalysisPanelTable")?.byId("strategyAnalysisPanel") ||
                         this.byId("strategyAnalysisPanelChart")?.byId("strategyAnalysisPanel");
    var oResultPanel = this.byId("strategyResultPanel") || sap.ui.core.Fragment.byId("strategyResultPanel");
    var sSymbol = oView.byId("symbolSelector").getSelectedKey();

    // Validaciones básicas
    if (!oStrategyModel.getProperty("/strategyKey")) {
        MessageBox.warning("Seleccione una estrategia");
        return;
    }
    if (!sSymbol) {
        MessageBox.warning("Seleccione un símbolo (ej: AAPL)");
        return;
    }

     if (oAnalysisPanel) {
        oAnalysisPanel.setExpanded(false);
    }
    // Expande el panel de resultados
    if (oResultPanel) {
        oResultPanel.setExpanded(true);
    }

    // Configurar petición
    var oRequestBody = {
        symbol: sSymbol,
        startDate: this._formatDate(oStrategyModel.getProperty("/startDate")),
        endDate: this._formatDate(oStrategyModel.getProperty("/endDate")),
        amount: 1000,
        userId: "ARAMIS",
        specs: `SHORT:${oStrategyModel.getProperty("/shortSMA")}&LONG:${oStrategyModel.getProperty("/longSMA")}`
    };

    // Llamada a la API
    fetch("http://localhost:3033/api/inv/simulation?strategy=macrossover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(oRequestBody)
    })
    .then(response => response.ok ? response.json() : Promise.reject(response))
    .then(data => {
        console.log("Datos recibidos:", data);
        
        // Guardar datos en el modelo
        oResultModel.setData({
            hasResults: true,
            chart_data: this._prepareTableData(data.value.chart_data || []),
            signals: data.value.signals || [],
            result: data.value.result || 0
        });

        // Sumar la ganancia al balance
        var oStrategyModel = this.getView().getModel("strategyAnalysisModel");
        var currentBalance = oStrategyModel.getProperty("/balance") || 0;
        var gainPerShare = data.value.result || 0;
        var stock = oStrategyModel.getProperty("/stock") || 1;
        var totalGain = +(gainPerShare * stock).toFixed(2);
        oStrategyModel.setProperty("/balance", currentBalance + totalGain);
        MessageToast.show("Se añadieron $" + totalGain + " a tu balance.");
    })
    .catch(error => {
        console.error("Error:", error);
        MessageBox.error("Error al obtener datos de simulación");
    });
},

// Función auxiliar para formatear fechas
_formatDate: function(oDate) {
    return oDate ? DateFormat.getDateInstance({pattern: "yyyy-MM-dd"}).format(oDate) : null;
},

    formatCurrency: function(value) {
        if (!value) return "$0.00";
        return `$${parseFloat(value).toFixed(2)}`;
    },

        formatDateRange: function(sStartDate, sEndDate) {
        if (!sStartDate || !sEndDate) return "";
        
        const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
            pattern: "dd/MM/yyyy"
        });
        
        const oStartDate = new Date(sStartDate);
        const oEndDate = new Date(sEndDate);
        
        return oDateFormat.format(oStartDate) + " - " + oDateFormat.format(oEndDate);
    },


// Función auxiliar para preparar datos para la tabla
_prepareTableData: function(aData) {
    if (!Array.isArray(aData)) return [];
    
    return aData.map(oItem => ({
        DATE: oItem.date,
        OPEN: oItem.open,
        HIGH: oItem.high,
        LOW: oItem.low,
        CLOSE: oItem.close,
        VOLUME: oItem.volume,
        SHORT_MA: oItem.short_ma,
        LONG_MA: oItem.long_ma
    }));
},

      onRefreshChart: function() {
        const oSymbolModel = this.getView().getModel("symbolModel");
        const sCurrentSymbol = oSymbolModel.getProperty("/selectedSymbol");

        if (sCurrentSymbol) {
            // Refresca los datos de la tabla y el gráfico
            this._loadPriceData(sCurrentSymbol);
        } else {
            const aSymbols = oSymbolModel.getProperty("/symbols");
            if (aSymbols && aSymbols.length > 0) {
                const sDefaultSymbol = aSymbols[0].symbol;
                oSymbolModel.setProperty("/selectedSymbol", sDefaultSymbol);
                this._loadPriceData(sDefaultSymbol);
            } else {
                MessageToast.show("Por favor, seleccione un símbolo.");
            }
        }
    },

    onDataPointSelect: function(oEvent) {
        const oData = oEvent.getParameter("data");
        console.log("Datos seleccionados:", oData);
    
        if (oData && oData.length > 0) {
            const oSelectedData = oData[0];
            console.log("Datos del punto seleccionado:", oSelectedData);
    
            const sFecha = oSelectedData.data.DATE; 
            const fPrecioCierre = oSelectedData.data.CLOSE; 
    
            if (sFecha && fPrecioCierre !== undefined) {
                const oViewModel = this.getView().getModel("viewModel");
                oViewModel.setProperty("/selectedPoint", {
                    DATE: sFecha,
                    CLOSE: fPrecioCierre
                });
            } else {
                console.warn("Los datos seleccionados no contienen DATE o CLOSE.");
            }
        } else {
            console.warn("No se seleccionaron datos.");
        }
    },

        //Historial de inversiones
    onHistoryPress: function(oEvent) {
        if (!this._oHistoryPopover) {
            this._oHistoryPopover = sap.ui.xmlfragment(
                "com.invertions.sapfiorimodinv.view.investments.fragments.InvestmentHistoryPanel",
                this
            );
            this.getView().addDependent(this._oHistoryPopover);
        }
        
        if (this._oHistoryPopover.isOpen()) {
            this._oHistoryPopover.close();
            return;
        }
        
        // Abrir la ventana
        this._oHistoryPopover.openBy(oEvent.getSource());

        this.getView().setModel(new JSONModel({
                isDeleteMode: false
            }), "historyModel");
    },

        // ******** FILTRO ********** //
    onToggleAdvancedFilters: function() {
        if (!this._oHistoryPopover) return;

        // Get panel directly from popover content
        const oPanel = sap.ui.getCore().byId("advancedFiltersPanel");
        
        if (oPanel) {
            oPanel.setVisible(!oPanel.getVisible());
        } else {
            console.warn("Advanced filters panel not found");
        }
    },

          // Método del Sidebar
      // onToggleSidebarPress: function() {
      //     var oSidebarLayoutData = this.byId("sidebarLayoutData"); 

      //     if (oSidebarLayoutData) {
      //         if (this._bSidebarExpanded) {
      //             this._sSidebarOriginalSize = oSidebarLayoutData.getSize();
      //             oSidebarLayoutData.setSize("0px");
      //         } else {
      //             oSidebarLayoutData.setSize(this._sSidebarOriginalSize);
      //         }
      //         this._bSidebarExpanded = !this._bSidebarExpanded;

      //         var oButton = this.byId("toggleSidebarButton");
      //         if (oButton) {
      //             oButton.setIcon(this._bSidebarExpanded ? "sap-icon://menu2" : "sap-icon://open-command-field");
      //         }
      //     } else {
      //         console.error("No se pudo encontrar sidebarLayoutData para plegar/desplegar.");
      //     }
      // },

    // onTimeIntervalChange: function(oEvent) {
    //     const sKey = oEvent.getParameter("selectedItem").getKey();
    //     const oPriceModel = this.getView().getModel("priceData");
    //     const aOriginalData = oPriceModel.getProperty("/originalValue"); // Datos originales
    //     const aData = aOriginalData || []; // Usa los datos originales si están disponibles
    
    //     if (!aData || aData.length === 0) {
    //         MessageToast.show("No hay datos originales disponibles para filtrar.");
    //         return;
    //     }
    
    //     // Calcula la fecha de inicio según el intervalo seleccionado
    //     const oEndDate = new Date();
    //     let oStartDate;
    //     switch (sKey) {
    //         case "1D": // Último día
    //             oStartDate = new Date(oEndDate);
    //             oStartDate.setDate(oEndDate.getDate() - 1);
    //             break;
    //         case "1W": // Última semana
    //             oStartDate = new Date(oEndDate);
    //             oStartDate.setDate(oEndDate.getDate() - 7);
    //             break;
    //         case "1M": // Último mes
    //             oStartDate = new Date(oEndDate);
    //             oStartDate.setMonth(oEndDate.getMonth() - 1);
    //             break;
    //         case "1Y": // Último año
    //             oStartDate = new Date(oEndDate);
    //             oStartDate.setFullYear(oEndDate.getFullYear() - 1);
    //             break;
    //         case "ALL": // Historial completo
    //         default:
    //             oStartDate = null; // No filtrar
    //             break;
    //     }
    
    //     // Filtra los datos según el intervalo
    //     const oDateFormat = DateFormat.getDateInstance({ pattern: "MM/dd/yyyy" });
    //     const aFilteredData = oStartDate
    //         ? aData.filter(oItem => {
    //             const oItemDate = new Date(oItem.DATE); // Usa new Date() para convertir la fecha
    //             return oItemDate >= oStartDate && oItemDate <= oEndDate;
    //         })
    //         : aData;
    
    //     if (aFilteredData.length === 0) {
    //         MessageToast.show("No hay datos disponibles para el intervalo seleccionado.");
    //         oPriceModel.setProperty("/value", aOriginalData); // Restaura los datos originales
    //         return;
    //     }
    
    //     // Actualiza el modelo con los datos filtrados
    //     console.log("Datos filtrados:", aFilteredData);
    //     oPriceModel.setProperty("/value", aFilteredData);
    // }
  });
});