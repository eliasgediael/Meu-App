import Foundation
import Capacitor
import ConnectIQ

/// Ponte com o app FORZA RUN do relógio Garmin (Connect IQ). O iPhone não fala direto com o relógio:
/// tudo passa pelo app Garmin Connect, que precisa estar instalado e pareado.
///
/// Fluxo:
/// 1. `escolher()` abre o Garmin Connect para a pessoa escolher o relógio; ele volta ao Forza Run pela URL
///    `forzarun-ciq://` com a lista de aparelhos (chega aqui pela notificação capacitorOpenURL).
/// 2. Os aparelhos ficam guardados (UserDefaults) e são reabertos a cada inicialização.
/// 3. `enviar({ mensagem })` manda a mensagem para o app FORZA RUN em cada relógio conectado.
/// 4. Mensagens do relógio chegam no evento "mensagem" ({ dados, relogio }).
@objc(RelogioGarminPlugin)
public class RelogioGarminPlugin: CAPPlugin, CAPBridgedPlugin, IQUIOverrideDelegate, IQDeviceEventDelegate, IQAppMessageDelegate {
    public let identifier = "RelogioGarminPlugin"
    public let jsName = "RelogioGarmin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "escolher", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "esquecer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enviar", returnType: CAPPluginReturnPromise)
    ]

    /// Id do app no manifest.xml do projeto Connect IQ (ad7a412961d14e91bcff3e12b826d604).
    private static let appUUID = UUID(uuidString: "ad7a4129-61d1-4e91-bcff-3e12b826d604")!
    /// Precisa ser igual ao CFBundleURLSchemes adicionado no Info.plist (workflow ios-build.yml).
    private static let urlScheme = "forzarun-ciq"
    private static let chaveAparelhos = "relogioGarmin.aparelhos"

    private var aparelhos: [IQDevice] = []
    private var precisaGarminConnect = false

    override public func load() {
        ConnectIQ.sharedInstance().initialize(withUrlScheme: Self.urlScheme, uiOverrideDelegate: self)
        aparelhos = carregarAparelhos()
        registrarTodos()
        NotificationCenter.default.addObserver(self, selector: #selector(abriuURL(_:)), name: .capacitorOpenURL, object: nil)
    }

    // MARK: - Métodos do JS

    @objc func estado(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.resumo()) }
    }

    @objc func escolher(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.precisaGarminConnect = false
            ConnectIQ.sharedInstance().showDeviceSelection()
            call.resolve(["abriuGarminConnect": !self.precisaGarminConnect])
        }
    }

    @objc func esquecer(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            ConnectIQ.sharedInstance().unregister(forAllAppMessages: self)
            ConnectIQ.sharedInstance().unregister(forAllDeviceEvents: self)
            self.aparelhos = []
            self.salvarAparelhos()
            call.resolve(self.resumo())
        }
    }

    /// Envia `mensagem` (objeto JSON) para cada relógio conectado. Resolve com o resultado de cada um.
    @objc func enviar(_ call: CAPPluginCall) {
        guard let mensagem = call.options["mensagem"] as? [AnyHashable: Any] else {
            call.reject("mensagem ausente")
            return
        }
        DispatchQueue.main.async {
            let alvos = self.aparelhos.filter { ConnectIQ.sharedInstance().getDeviceStatus($0) == .connected }
            if alvos.isEmpty {
                call.resolve(["enviados": 0, "resultados": [], "motivo": self.aparelhos.isEmpty ? "sem_relogio" : "desconectado"])
                return
            }
            var resultados: [[String: Any]] = []
            var enviados = 0
            let grupo = DispatchGroup()
            for aparelho in alvos {
                grupo.enter()
                let app = IQApp(uuid: Self.appUUID, store: Self.appUUID, device: aparelho)
                ConnectIQ.sharedInstance().sendMessage(mensagem, to: app, progress: nil) { resultado in
                    if resultado == .success { enviados += 1 }
                    resultados.append(["relogio": aparelho.friendlyName ?? "", "resultado": NSStringFromSendMessageResult(resultado) ?? ""])
                    grupo.leave()
                }
            }
            grupo.notify(queue: .main) {
                call.resolve(["enviados": enviados, "resultados": resultados])
            }
        }
    }

    // MARK: - Volta do Garmin Connect com a lista de relógios

    @objc private func abriuURL(_ notificacao: Notification) {
        guard let dados = notificacao.object as? [String: Any], let url = dados["url"] as? URL,
              url.scheme?.lowercased() == Self.urlScheme else { return }
        DispatchQueue.main.async {
            guard let lista = ConnectIQ.sharedInstance().parseDeviceSelectionResponse(from: url) as? [IQDevice] else { return }
            ConnectIQ.sharedInstance().unregister(forAllAppMessages: self)
            ConnectIQ.sharedInstance().unregister(forAllDeviceEvents: self)
            self.aparelhos = lista
            self.salvarAparelhos()
            self.registrarTodos()
            self.notifyListeners("relogios", data: self.resumo(), retainUntilConsumed: true)
        }
    }

    // MARK: - Delegates do Connect IQ

    public func needsToInstallConnectMobile() {
        precisaGarminConnect = true
        notifyListeners("relogios", data: resumo(), retainUntilConsumed: true)
    }

    public func deviceStatusChanged(_ device: IQDevice!, status: IQDeviceStatus) {
        notifyListeners("relogios", data: resumo())
        // Ao conectar, a mensagem do relógio é registrada de novo (o SDK pede registro com o aparelho ativo).
        if status == .connected { registrarMensagens(device) }
    }

    public func receivedMessage(_ message: Any!, from app: IQApp!) {
        var dados: JSObject = ["relogio": app?.device?.friendlyName ?? ""]
        if let dic = message as? [String: Any] {
            dados["dados"] = JSTypes.coerceDictionaryToJSObject(dic as NSDictionary) ?? [:]
        } else {
            return
        }
        // retainUntilConsumed: se o JS ainda não registrou o ouvinte (app abrindo), a mensagem espera.
        notifyListeners("mensagem", data: dados, retainUntilConsumed: true)
    }

    // MARK: - Aparelhos

    private func registrarTodos() {
        for aparelho in aparelhos {
            ConnectIQ.sharedInstance().register(forDeviceEvents: aparelho, delegate: self)
            registrarMensagens(aparelho)
        }
    }

    private func registrarMensagens(_ aparelho: IQDevice) {
        let app = IQApp(uuid: Self.appUUID, store: Self.appUUID, device: aparelho)
        ConnectIQ.sharedInstance().register(forAppMessages: app, delegate: self)
    }

    private func resumo() -> JSObject {
        let lista: [JSObject] = aparelhos.map { a in
            ["id": a.uuid.uuidString, "nome": a.friendlyName ?? "", "modelo": a.modelName ?? "",
             "status": Self.textoStatus(ConnectIQ.sharedInstance().getDeviceStatus(a))]
        }
        return ["relogios": lista, "precisaGarminConnect": precisaGarminConnect]
    }

    private static func textoStatus(_ s: IQDeviceStatus) -> String {
        switch s {
        case .connected: return "conectado"
        case .notConnected: return "desconectado"
        case .bluetoothNotReady: return "bluetooth_desligado"
        case .notFound: return "nao_encontrado"
        default: return "invalido"
        }
    }

    private func salvarAparelhos() {
        let dados = try? NSKeyedArchiver.archivedData(withRootObject: aparelhos, requiringSecureCoding: true)
        UserDefaults.standard.set(dados, forKey: Self.chaveAparelhos)
    }

    private func carregarAparelhos() -> [IQDevice] {
        guard let dados = UserDefaults.standard.data(forKey: Self.chaveAparelhos) else { return [] }
        let lista = try? NSKeyedUnarchiver.unarchivedObject(ofClasses: [NSArray.self, IQDevice.self], from: dados)
        return (lista as? [IQDevice]) ?? []
    }
}
