/*global Ultraviolet*/
self.__uv$config = {
    prefix: '/proxy-assets/uv/service/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/proxy-assets/uv/uv.handler.js',
    client: '/proxy-assets/uv/uv.client.js',
    bundle: '/proxy-assets/uv/uv.bundle.js',
    config: '/proxy-assets/uv/uv.config.js',
    sw: '/proxy-assets/uv/uv.sw.js',
};
