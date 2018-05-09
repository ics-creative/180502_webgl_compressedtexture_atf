import {TextureObject} from '../myLib/webgl/engine/TextureObject';

export class CompressedTexture extends TextureObject
{
  public setCompressedImage(dataList:Uint8Array[], internalformat:number, width:number, height:number):void
  {
    this.context.bindTexture(this.context.TEXTURE_2D, this.texture);

    let useMipmap:boolean = true;
    const length:number = dataList.length;
    for(let i:number = 0; i < length; i++)
    {
      if(dataList[i].length)
      {
        this.context.compressedTexImage2D(this.context.TEXTURE_2D, i, internalformat, width >> i, height >> i, 0, dataList[i]);
      }
      else
      {
        useMipmap = false;
      }
    }

    if(useMipmap)
    {
      this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.LINEAR_MIPMAP_LINEAR);
    }
    else
    {
      this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.LINEAR);
    }

    this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MAG_FILTER, this.context.LINEAR);
    this.context.bindTexture(this.context.TEXTURE_2D, null);
  }
}
