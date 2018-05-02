export interface ATFCompressedTextureData
{
  useAlpha:boolean;
  internalformat:number;
  dataList:Uint8Array[];
  alphaDataList:Uint8Array[];
}

export class ATF
{
  private static readonly RGB888:number = 0x00;
  private static readonly RGBA88888:number = 0x01;
  private static readonly Compressed:number = 0x02;
  private static readonly RAW_Compressed:number = 0x03;
  private static readonly Compressed_with_Alpha:number = 0x04;
  private static readonly RAW_Compressed_with_Alpha:number = 0x05;
  private static readonly Compressed_Lossy:number = 0x0C;
  private static readonly Compressed_Lossy_with_Alpha:number = 0x0D;

  private static readonly WEBGL_compressed_texture_s3tc__COMPRESSED_RGB_S3TC_DXT1_EXT:number = 0x83F0;
  private static readonly WEBGL_compressed_texture_s3tc__COMPRESSED_RGBA_S3TC_DXT5_EXT:number = 0x83F3;
  private static readonly WEBGL_compressed_texture_pvrtc__COMPRESSED_RGB_PVRTC_4BPPV1_IMG:number = 0x8C00;
  private static readonly WEBGL_compressed_texture_pvrtc__COMPRESSED_RGBA_PVRTC_4BPPV1_IMG:number = 0x8C02;
  private static readonly WEBGL_compressed_texture_etc1__COMPRESSED_RGB_ETC1_WEBGL:number = 0x8D64;

  public width:number;
  public height:number;

  public dxtData:ATFCompressedTextureData;
  public pvrtcData:ATFCompressedTextureData;
  public etc1Data:ATFCompressedTextureData;

  constructor(data:Uint8Array)
  {
    // https://www.adobe.com/devnet/archive/flashruntimes/articles/atf-file-format.html

    // console.log(data);

    const byteLength:number = data.byteLength;
    console.log('data byteLength:', byteLength);

    // Signature U8[3]
    // Always ‘ATF’.
    const signature:Uint8Array = data.subarray(0, 3);
    const signatureStr:string = String.fromCharCode.apply('', signature);
    console.log('Signature:', signatureStr);

    if(signatureStr !== 'ATF')
    {
      throw new Error('This file is not ATF format.');
    }

    // Reserved U32
    // First byte: 0x00
    // Second byte: 0x00
    // Third byte: LSB indicates if '-e' switch is used or not and remaining 7 bits indicates actual number of mipmap packaged if '-n' switch is used.
    // Fourth byte: 0xff
    const reserved:Uint8Array = data.subarray(3, 7);
    console.log('Reserved:', reserved);
    console.log('-e:', reserved[2] & 0x01);
    console.log('-n:', (reserved[2] & 0xFE) >> 1);

    // Version U8
    // Version of ATF file format.
    const version:number = data[7];
    console.log('Version:', version);

    // Length U32
    // Size of ATF file in bytes, does not include signature, reserved, version bytes, and this length field.
    const length:number = ATF.getValue(data.subarray(8, 12));
    console.log('Length:', length);

    if(data.byteLength !== length + 12)
    {
      throw new Error('Length does not match to file size, this file maybe broken.');
    }

    // Cubemap UB[1]
    // 0 = normal texture
    // 1 = cube map texture
    const cubemap:number = data[12] & 0x80;
    console.log('Cubemap:', cubemap);

    // Format UB[7]
    // 0 = RGB888
    // 1 = RGBA88888
    // 2 = Compressed
    // 3 = RAW Compressed
    // 4 = Compressed with Alpha
    // 5 = RAW Compressed with Alpha
    // 0x0c = Compressed Lossy
    // 0x0d = Compressed Lossy with Alpha
    const format:number = data[12] & 0x7F;
    console.log('Format:', format);

    // Log2Width U8
    // Width of texture expressed as 2^Log- 2Width. Maximum value allowed is 12.
    const log2Width:number = data[13];
    console.log('Log2Width:', log2Width);
    this.width = 1 << log2Width;

    // Log2Height U8
    // Height of texture expressed as 2^Log2Height. Maximum value allowed is 12.
    const log2Height:number = data[14];
    console.log('Log2Height:', log2Height);
    this.height = 1 << log2Height;

    // Count U8
    // Total number of textures encoded per face. Maximum value allowed is 13.
    const count:number = data[15];
    console.log('Count:', count);

    console.log('-----------------------');

    if(cubemap === 0)
    {
      switch(format)
      {
        case ATF.RAW_Compressed:
          this.parseATFRAWCOMPRESSED(data.subarray(16, byteLength), count);
          break;
        case ATF.RAW_Compressed_with_Alpha:
          this.parseATFRAWCOMPRESSEDALPHA(data.subarray(16, byteLength), count);
          break;
        default:
          throw new Error('Format is not supported by this Parser yet.');
      }
    }
    else
    {
      throw new Error('Cubemap is not supported by this Parser yet.');
    }
  }

  private parseATFRAWCOMPRESSED(data:Uint8Array, count:number):void
  {
    // console.log(data);

    const dXT1ImageData:Uint8Array[] = Array(count);
    const pVRTCImageData:Uint8Array[] = Array(count);
    const eTC1ImageData:Uint8Array[] = Array(count);
    const eTC2RgbImageData:Uint8Array[] = Array(count);

    let position:number = 0;

    for(let i:number = 0; i < count; i++)
    {
      // DXT1ImageDataLength U32
      // Length of DXT1 image data in bytes
      const dXT1ImageDataLength:number = ATF.getValue(data.subarray(position, position + 4));
      position += 4;
      // console.log('DXT1ImageDataLength:', dXT1ImageDataLength);

      // DXT1ImageData U8[DXT1ImageDataLength]
      // RAW DXT1 data
      dXT1ImageData[i] = data.subarray(position, position + dXT1ImageDataLength);
      position += dXT1ImageDataLength;
      // console.log('DXT1ImageData:', dXT1ImageData[i]);

      // PVRTCImageDataLength U32
      // Length of PVRTC4bpp image data in bytes
      const pVRTCImageDataLength:number = ATF.getValue(data.subarray(position, position + 4));
      position += 4;
      // console.log('PVRTCImageDataLength:', pVRTCImageDataLength);

      // PVRTCImageData U8[PVRTCImageDataLength]
      // RAW PVRTC data
      pVRTCImageData[i] = data.subarray(position, position + pVRTCImageDataLength);
      position += pVRTCImageDataLength;
      // console.log('PVRTCImageData:', pVRTCImageData[i]);

      // ETC1ImageDataLength U32
      // Length of ETC1 image data in bytes
      const eTC1ImageDataLength:number = ATF.getValue(data.subarray(position, position + 4));
      position += 4;
      // console.log('ETC1ImageDataLength:', eTC1ImageDataLength);

      // ETC1ImageData U8[ETC1ImageDataLength]
      // RAW ETC1 data
      eTC1ImageData[i] = data.subarray(position, position + eTC1ImageDataLength);
      position += eTC1ImageDataLength;
      // console.log('ETC1ImageData:', eTC1ImageData[i]);

      // ETC2RgbImageDataLength U32
      // Length of ETC2Rgb image data in bytes
      const eTC2RgbImageDataLength:number = ATF.getValue(data.subarray(position, position + 4));
      position += 4;
      // console.log('ETC2RgbImageDataLength:', eTC2RgbImageDataLength);

      // ETC2RgbImageData U8[ETC2RgbImageDataLength]
      // RAW ETC2Rgb data
      eTC2RgbImageData[i] = data.subarray(position, position + eTC2RgbImageDataLength);
      position += eTC2RgbImageDataLength;
      // console.log('ETC2RgbImageData:', eTC2RgbImageData[i]);

      // console.log('-----------------------');
    }

    if(dXT1ImageData.length && dXT1ImageData[0].length)
    {
      this.dxtData = {
        useAlpha:false,
        internalformat:ATF.WEBGL_compressed_texture_s3tc__COMPRESSED_RGB_S3TC_DXT1_EXT,
        dataList:dXT1ImageData,
        alphaDataList:null
      };
    }
    if(pVRTCImageData.length && pVRTCImageData[0].length)
    {
      this.pvrtcData = {
        useAlpha:false,
        internalformat:ATF.WEBGL_compressed_texture_pvrtc__COMPRESSED_RGB_PVRTC_4BPPV1_IMG,
        dataList:pVRTCImageData,
        alphaDataList:null
      };
    }
    if(eTC1ImageData.length && eTC1ImageData[0].length)
    {
      this.etc1Data = {
        useAlpha:false,
        internalformat:ATF.WEBGL_compressed_texture_etc1__COMPRESSED_RGB_ETC1_WEBGL,
        dataList:eTC1ImageData,
        alphaDataList:null
      };
    }
  }

  private parseATFRAWCOMPRESSEDALPHA(data:Uint8Array, count:number):void
  {
    // console.log(data);

    const dXT5ImageData:Uint8Array[] = Array(count);
    const pVRTCImageData:Uint8Array[] = Array(count);
    const eTC1ImageData:Uint8Array[] = Array(count);
    const eTC1AlphaImageData:Uint8Array[] = Array(count);
    const eTC2RgbaImageData:Uint8Array[] = Array(count);

    let position:number = 0;

    for(let i:number = 0; i < count; i++)
    {
      // DXT5ImageDataLength U32
      // Length of DXT5 image data in bytes
      const dXT5ImageDataLength:number = ATF.getValue(data.subarray(position, position + 4));
      position += 4;
      // console.log('DXT5ImageDataLength:', dXT5ImageDataLength);

      // DXT5ImageData U8[DXT5ImageDataLength]
      // RAW DXT5 data
      dXT5ImageData[i] = data.subarray(position, position + dXT5ImageDataLength);
      position += dXT5ImageDataLength;
      // console.log('DXT5ImageData:', dXT5ImageData[i]);

      // PVRTCImageDataLength U32
      // Length of PVRTC4bpp image data in bytes
      const pVRTCImageDataLength:number = ATF.getValue(data.subarray(position, position + 4));
      position += 4;
      // console.log('PVRTCImageDataLength:', pVRTCImageDataLength);

      // PVRTCImageData U8[PVRTCImageDataLength]
      // RAW PVRTC data
      pVRTCImageData[i] = data.subarray(position, position + pVRTCImageDataLength);
      position += pVRTCImageDataLength;
      // console.log('PVRTCImageData:', pVRTCImageData[i]);

      // ETC1ImageDataLength U32
      // Length of ETC1 image data in bytes
      const eTC1ImageDataLength:number = ATF.getValue(data.subarray(position, position + 4));
      position += 4;
      // console.log('ETC1ImageDataLength:', eTC1ImageDataLength);

      const eTC1ImageDataIndividualLength:number = eTC1ImageDataLength / 2;

      // ETC1ImageData U8[ETC1ImageDataLength/2]
      // RAW ETC1 data
      eTC1ImageData[i] = data.subarray(position, position + eTC1ImageDataIndividualLength);
      position += eTC1ImageDataIndividualLength;
      // console.log('ETC1ImageData:', eTC1ImageData[i]);

      // ETC1AlphaImageData U8[ETC1ImageDataLength/2]
      // RAW ETC1 data
      eTC1AlphaImageData[i] = data.subarray(position, position + eTC1ImageDataIndividualLength);
      position += eTC1ImageDataIndividualLength;
      // console.log('ETC1AlphaImageData:', eTC1AlphaImageData[i]);

      // ETC2RgbaImageDataLength U32
      // Length of ETC2Rgba image data in bytes
      const eTC2RgbaImageDataLength:number = ATF.getValue(data.subarray(position, position + 4));
      position += 4;
      // console.log('ETC2RgbaImageDataLength:', eTC2RgbaImageDataLength);

      // ETC2RgbaImageData U8[ETC2RgbImageDataLength]
      // RAW ETC2Rgba data
      eTC2RgbaImageData[i] = data.subarray(position, position + eTC2RgbaImageDataLength);
      position += eTC2RgbaImageDataLength;
      // console.log('ETC2RgbImageData:', eTC2RgbaImageData[i]);

      // console.log('-----------------------');
    }

    if(dXT5ImageData.length && dXT5ImageData[0].length)
    {
      this.dxtData = {
        useAlpha:true,
        internalformat:ATF.WEBGL_compressed_texture_s3tc__COMPRESSED_RGBA_S3TC_DXT5_EXT,
        dataList:dXT5ImageData,
        alphaDataList:null
      };
    }

    if(pVRTCImageData.length && pVRTCImageData[0].length)
    {
      this.pvrtcData = {
        useAlpha:true,
        internalformat:ATF.WEBGL_compressed_texture_pvrtc__COMPRESSED_RGBA_PVRTC_4BPPV1_IMG,
        dataList:pVRTCImageData,
        alphaDataList:null
      };
    }

    if(eTC1ImageData.length && eTC1ImageData[0].length)
    {
      this.etc1Data = {
        useAlpha:true,
        internalformat:ATF.WEBGL_compressed_texture_etc1__COMPRESSED_RGB_ETC1_WEBGL,
        dataList:eTC1ImageData,
        alphaDataList:eTC1AlphaImageData
      };
    }
  }

  private static getValue(data:Uint8Array):number
  {
    let value:number = 0;
    const length:number = data.length;
    for(let i:number = 0; i < length; i++)
    {
      value += data[i] << ((length - i - 1) * 8);
    }
    return value;
  }
}
