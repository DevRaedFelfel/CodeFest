using CodeFest.Api.Services;
using Microsoft.Extensions.Configuration;

namespace CodeFest.Api.Tests.Services;

public class QrCodeServiceTests
{
    private QrCodeService CreateService(string baseUrl = "https://codefest.test/join")
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CodeFest:Session:ShareableLinkBase"] = baseUrl
            })
            .Build();
        return new QrCodeService(config);
    }

    [Fact]
    public void GenerateShareableLink_CombinesBaseAndCode()
    {
        var service = CreateService();
        var link = service.GenerateShareableLink("ABC123");

        Assert.Equal("https://codefest.test/join/ABC123", link);
    }

    [Fact]
    public void GenerateShareableLink_UsesDefaultBaseWhenMissing()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        var service = new QrCodeService(config);

        var link = service.GenerateShareableLink("XYZ789");

        Assert.Equal("https://codefest.yourdomain.com/join/XYZ789", link);
    }

    [Fact]
    public void GenerateQrCodeBase64_ReturnsValidBase64()
    {
        var service = CreateService();
        var base64 = service.GenerateQrCodeBase64("https://codefest.test/join/ABC123");

        Assert.NotNull(base64);
        Assert.NotEmpty(base64);

        // Should be valid base64
        var bytes = Convert.FromBase64String(base64);
        Assert.True(bytes.Length > 0);

        // Should be a valid PNG (starts with PNG header)
        Assert.Equal(0x89, bytes[0]);
        Assert.Equal(0x50, bytes[1]); // P
        Assert.Equal(0x4E, bytes[2]); // N
        Assert.Equal(0x47, bytes[3]); // G
    }
}
