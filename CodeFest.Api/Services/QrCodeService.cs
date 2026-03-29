using QRCoder;

namespace CodeFest.Api.Services;

public class QrCodeService
{
    private readonly IConfiguration _config;

    public QrCodeService(IConfiguration config)
    {
        _config = config;
    }

    public string GenerateShareableLink(string sessionCode)
    {
        var baseUrl = _config["CodeFest:Session:ShareableLinkBase"] ?? "https://codefest.yourdomain.com/join";
        return $"{baseUrl}/{sessionCode}";
    }

    public string GenerateQrCodeBase64(string url)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);
        using var qrCode = new PngByteQRCode(qrCodeData);
        var pngBytes = qrCode.GetGraphic(10);
        return Convert.ToBase64String(pngBytes);
    }
}
